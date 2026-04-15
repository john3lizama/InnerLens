"""
mood.py router — Timeseries endpoint behind the Home-tab mood graph.

Collapses the per-message and per-journal `emotion_tags` JSONB into one
(date, dominant_emotion, intensity, valence) point per day within a
caller-controlled window. Also returns gating counts so the client can
decide whether to show the real graph or the example/locked state.

Aggregation is intentionally simple:
  - Flatten emotion_tags across both sources, bucketed to the user's local
    date (Postgres-side, matching app/routers/activity.py's pattern).
  - Sum intensities per (date, emotion). Dominant = argmax per day.
  - Intensity reported = mean of the dominant's contributions that day.
  - Valence from app.ai.emotion_valence — unknown keys default to 0.

Window cap is 60 days: long enough to cover the Home card's 14-day view
comfortably and any near-future "show me last month" follow-up, short
enough that the JSONB scan stays bounded.
"""

import logging
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

from app.ai.emotion_valence import valence_of, EMOTION_VALENCE
from app.db.database import get_db
from app.models.journal_entry import JournalEntry
from app.models.message import Message
from app.models.session import Session
from app.schemas.mood import MoodDay, MoodTimeseriesResponse
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

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


def _collapse(rows: Iterable[tuple[date, Any]]) -> list[MoodDay]:
    """Reduce (local_date, emotion_tags_jsonb) rows to one MoodDay per day."""
    # (day, emotion) -> list of intensities
    per_day_emotion: dict[tuple[date, str], list[float]] = defaultdict(list)
    for d, tags in rows:
        for emo, iv in _iter_tags(tags):
            per_day_emotion[(d, emo)].append(iv)

    # Group back by day, pick dominant.
    per_day: dict[date, list[tuple[str, list[float]]]] = defaultdict(list)
    for (d, emo), ivs in per_day_emotion.items():
        per_day[d].append((emo, ivs))

    out: list[MoodDay] = []
    for d in sorted(per_day.keys()):
        contributions = per_day[d]
        # Dominant by summed intensity; tiebreak on |valence| (prefer
        # something with signal over neutrals), then alphabetical for
        # determinism across requests.
        contributions.sort(
            key=lambda c: (-sum(c[1]), -abs(valence_of(c[0])), c[0])
        )
        dom_emo, dom_ivs = contributions[0]
        mean_intensity = sum(dom_ivs) / len(dom_ivs)
        out.append(MoodDay(
            date=d.isoformat(),
            dominant_emotion=dom_emo,
            intensity=round(mean_intensity, 4),
            valence=valence_of(dom_emo),
        ))
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
    Return the user's mood as one dominant-emotion point per day across the
    last `days` days, plus gating counts so the client can show the
    locked/example state when the user hasn't contributed enough signal yet.

    A day with no tags is omitted from `days` (a missing day is not a
    neutral day).
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

    # Log once per call if the classifier produces keys not explicitly
    # catalogued in EMOTION_VALENCE. These still render correctly via the
    # substring-heuristic fallback in `valence_of()`, but keeping a trail
    # helps us grow the explicit table over time.
    unknowns = {
        d.dominant_emotion for d in days_out
        if d.dominant_emotion not in EMOTION_VALENCE
    }
    if unknowns:
        logger.info(
            "mood: emotions resolved via heuristic (consider adding to EMOTION_VALENCE): %s",
            sorted(unknowns),
        )

    return MoodTimeseriesResponse(
        days=days_out,
        conversation_count=conversation_count,
        journal_count=journal_count,
        unlocked=unlocked,
    )
