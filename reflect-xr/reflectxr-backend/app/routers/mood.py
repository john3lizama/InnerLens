"""
mood.py router — Timeseries endpoint behind the Home-tab mood graph.

Collapses the per-message and per-journal `emotion_tags` JSONB into a
positive / negative / neutral breakdown per day within a caller-
controlled window. Also returns gating counts so the client can decide
whether to show the real graph or the example/locked state.

Aggregation is valence-only, intensity-weighted:
  - Flatten emotion_tags across both sources, bucketed to the user's local
    date (Postgres-side, matching app/routers/activity.py's pattern).
  - Resolve each raw emotion to a sign via `valence_of()` (+1 / -1 / 0)
    and sum its intensity into the matching bucket for that day.
  - For each day, divide by the day's total so every day's shares sum
    to ~1.0. Emit one `EmotionShare` per non-empty bucket, with
    `emotion ∈ {"positive","negative","neutral"}`.
  - The client renders each day's pill at full height and divides it
    proportionally by share — a day with only positive activity is a
    solid pill; a day mixing all three shows three stacked bands.

Window cap is 60 days: long enough to cover the Home card's 14-day view
comfortably and any near-future "show me last month" follow-up, short
enough that the JSONB scan stays bounded.
"""

import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Iterable

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, cast, func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from app.ai.emotion_valence import valence_of
from app.db.database import get_db
from app.models.journal_entry import JournalEntry
from app.models.message import Message
from app.models.session import Session
from app.schemas.mood import EmotionShare, MoodDay, MoodTimeseriesResponse
from app.services.auth_service import get_current_user

router = APIRouter()


# ── Timezone helpers (mirror app/routers/activity.py) ───────────────────
_TZ_RE = re.compile(r"^[A-Za-z_]+(?:/[A-Za-z_+\-0-9]+){0,2}$")


def _valid_tz(tz: str | None) -> str:
    if tz and len(tz) <= 64 and _TZ_RE.match(tz):
        return tz
    return "UTC"


def _local_date(col, tz: str):
    """Postgres expression for the user-local date of a naive-UTC timestamp."""
    return cast(func.timezone(tz, func.timezone("UTC", col)), Date)


def _today_in_tz(tz: str) -> date:
    if ZoneInfo is None:
        return date.today()
    try:
        return datetime.now(ZoneInfo(tz)).date()
    except Exception:
        return date.today()


# ── Aggregation ─────────────────────────────────────────────────────────

def _iter_tags(raw: Any) -> Iterable[tuple[str, float]]:
    """Yield (emotion, intensity) from a JSONB array, defensive against
    malformed rows (bad types, missing keys, out-of-range intensity)."""
    if not isinstance(raw, list):
        return
    for item in raw:
        if not isinstance(item, dict):
            continue
        emotion = item.get("emotion")
        intensity = item.get("intensity")
        if not isinstance(emotion, str):
            continue
        try:
            iv = float(intensity)
        except (TypeError, ValueError):
            continue
        # Clamp to [0, 1] — extractor is meant to stay in range, but
        # downstream math assumes it.
        iv = max(0.0, min(1.0, iv))
        if iv <= 0:
            continue
        yield emotion.lower(), iv


_VALENCE_BUCKET: dict[int, str] = {1: "positive", -1: "negative", 0: "neutral"}


def _collapse(rows: Iterable[tuple[date, Any]]) -> list[MoodDay]:
    """Reduce (local_date, emotion_tags_jsonb) rows to one MoodDay per day.

    Each raw emotion is folded onto its valence sign (+1/-1/0), intensities
    are summed per sign, and the day's three bucket totals are divided by
    the day's grand total so shares sum to ~1.0. Empty buckets are omitted
    — a day whose activity was entirely positive returns a single
    `EmotionShare` with emotion="positive", share=1.0."""
    # day -> valence sign -> summed intensity
    by_day: dict[date, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for d, tags in rows:
        for emo, iv in _iter_tags(tags):
            by_day[d][valence_of(emo)] += iv

    out: list[MoodDay] = []
    for d in sorted(by_day.keys()):
        totals = by_day[d]
        s = sum(totals.values())
        if s <= 0:
            continue
        # Deterministic pos → neg → neutral ordering. The client re-sorts
        # by share desc before rendering, so ordering here is cosmetic —
        # primarily useful when eyeballing raw API output.
        shares = [
            EmotionShare(
                emotion=_VALENCE_BUCKET[v],
                share=round(totals[v] / s, 6),
                valence=v,
            )
            for v in (1, -1, 0) if totals.get(v, 0) > 0
        ]
        out.append(MoodDay(date=d.isoformat(), emotions=shares))
    return out


# ── Endpoint ────────────────────────────────────────────────────────────

@router.get("/timeseries", response_model=MoodTimeseriesResponse)
async def get_mood_timeseries(
    days: int = Query(14, ge=1, le=60, description="Window length in days"),
    tz: str | None = Query(None, description="IANA timezone id"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return the user's mood as a positive/negative/neutral breakdown per day
    across the last `days` days, plus gating counts so the client can show
    the locked/example state when the user hasn't contributed enough signal
    yet.

    Each day's `emotions[]` has 1-3 entries (one per non-empty valence
    bucket), shares sum to ~1.0. The client stacks them into a 100%-height
    pill. A day with no tags is omitted from `days` (a missing day is not
    a neutral day).
    """
    user_tz = _valid_tz(tz)
    today = _today_in_tz(user_tz)
    window_start = today - timedelta(days=days - 1)

    msg_local = _local_date(Message.created_at, user_tz)
    j_local = _local_date(JournalEntry.created_at, user_tz)

    # Chat-source messages owned by this user that carry emotion_tags.
    # Matches the activity router's inclusion rule: anything that isn't
    # the 'create' flow (so in-app MindMate + Alexa + HomePod all count).
    msg_query = (
        select(
            msg_local.label("local_date"),
            Message.emotion_tags.label("emotion_tags"),
        )
        .join(Session, Session.id == Message.session_id)
        .where(
            Session.user_id == current_user.id,
            Session.source != "create",
            Message.emotion_tags.isnot(None),
            msg_local >= window_start,
            msg_local <= today,
        )
    )

    journal_query = (
        select(
            j_local.label("local_date"),
            JournalEntry.emotion_tags.label("emotion_tags"),
        )
        .where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.emotion_tags.isnot(None),
            j_local >= window_start,
            j_local <= today,
        )
    )

    union_stmt = union_all(msg_query, journal_query)
    result = await db.execute(union_stmt)
    rows = [(row[0], row[1]) for row in result.all()]
    days_out = _collapse(rows)

    # ── Gating counts ───────────────────────────────────────────────────
    # "conversations" mirrors activity/stats semantics: any non-'create'
    # session counts. Journals: total for the user.
    conv_result = await db.execute(
        select(func.count(Session.id)).where(
            Session.user_id == current_user.id,
            Session.source != "create",
        )
    )
    conversation_count = conv_result.scalar() or 0

    journal_result = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.user_id == current_user.id,
        )
    )
    journal_count = journal_result.scalar() or 0

    unlocked = (conversation_count + journal_count) >= 3

    return MoodTimeseriesResponse(
        days=days_out,
        conversation_count=conversation_count,
        journal_count=journal_count,
        unlocked=unlocked,
    )
