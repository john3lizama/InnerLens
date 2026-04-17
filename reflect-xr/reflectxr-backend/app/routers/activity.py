"""
activity.py router — User activity tracking for the profile grid.

Single endpoint that returns all dates in a given year where the user
had at least one journal entry or chat session (in-app, Alexa, or HomePod).

All date arithmetic is done in the caller's timezone (passed as ?tz=…).
Without this, a late-night entry in UTC-behind timezones would jump to the
next day on the grid, and the streak badge would disagree with what the
user actually sees on the calendar.
"""

import re
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, union, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

try:
    # Python 3.9+: stdlib IANA zone database (Docker image typically has tzdata)
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from app.db.database import get_db
from app.models.journal_entry import JournalEntry
from app.models.message import Message
from app.models.session import Session
from app.schemas.activity import (
    ActivityDatesResponse, ActivityStatsResponse,
    StreakResponse, RecentDay,
)
from app.services.auth_service import get_current_user

router = APIRouter()


# ── Timezone helpers ─────────────────────────────────────────────────────
# Whitelist validator: only accept strings that look like IANA TZ ids
# ("America/Los_Angeles", "UTC", "Etc/GMT+7"). Defense-in-depth even though
# SQLAlchemy binds tz as a parameter — we don't want weird strings in logs
# either.
_TZ_RE = re.compile(r"^[A-Za-z_]+(?:/[A-Za-z_+\-0-9]+){0,2}$")


def _valid_tz(tz: str | None) -> str:
    """Return tz if it looks like a valid IANA id; fall back to UTC."""
    if tz and len(tz) <= 64 and _TZ_RE.match(tz):
        return tz
    return "UTC"


def _local_date(col, tz: str):
    """
    Postgres expression for the user-local date of a naive-UTC timestamp.

    `created_at` is TIMESTAMP WITHOUT TIME ZONE written by server_default=now()
    in UTC. We first attach 'UTC' to make it TIMESTAMP WITH TIME ZONE, then
    shift to the user's tz (which drops the tz and returns wall-clock time
    there), then cast to Date.
    """
    return cast(func.timezone(tz, func.timezone("UTC", col)), Date)


def _today_in_tz(tz: str) -> date:
    """Today in the user's timezone — falls back to UTC if zoneinfo is absent."""
    if ZoneInfo is None:
        return date.today()
    try:
        return datetime.now(ZoneInfo(tz)).date()
    except Exception:
        return date.today()


@router.get("/dates", response_model=ActivityDatesResponse)
async def get_activity_dates(
    year: int = Query(..., ge=2020, le=2100, description="Year to fetch activity for"),
    tz: str | None = Query(None, description="IANA timezone id (e.g. 'America/Los_Angeles')"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return all dates in a given year where the user was active.

    A day counts as active if the user:
    - Saved at least one journal reflection, OR
    - Had at least one chat session (in-app MindMate, Alexa, or HomePod)

    Returns a sorted list of date strings in YYYY-MM-DD format, computed in
    the caller's timezone.
    """
    user_tz = _valid_tz(tz)
    j_local = _local_date(JournalEntry.created_at, user_tz)
    # Chat activity keys on Message.created_at (not Session.created_at) so a
    # message sent today inside a session started days ago still counts as
    # activity today. Matches the day-bucketing used by /mood/timeseries
    # (app/routers/mood.py) — without this alignment, the Home mood graph
    # can light up a day that the streak treats as inactive.
    m_local = _local_date(Message.created_at, user_tz)

    journal_dates = (
        select(j_local.label("active_date"))
        .where(
            JournalEntry.user_id == current_user.id,
            func.extract("year", j_local) == year,
        )
    )

    session_dates = (
        select(m_local.label("active_date"))
        .join(Session, Session.id == Message.session_id)
        .where(
            Session.user_id == current_user.id,
            Session.source != "create",
            func.extract("year", m_local) == year,
        )
    )

    combined = union(journal_dates, session_dates).subquery()
    result = await db.execute(
        select(combined.c.active_date).distinct().order_by(combined.c.active_date)
    )

    dates = [row[0].isoformat() for row in result.all()]
    return ActivityDatesResponse(dates=dates)


@router.get("/stats", response_model=ActivityStatsResponse)
async def get_activity_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return aggregate activity counts for the user's profile.

    - reflections: total journal entries
    - conversations: total chat sessions (MindMate in-app, Alexa, HomePod)
    """
    reflection_result = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.user_id == current_user.id
        )
    )
    reflections = reflection_result.scalar() or 0

    conversation_result = await db.execute(
        select(func.count(Session.id)).where(
            Session.user_id == current_user.id,
            Session.source != "create",
        )
    )
    conversations = conversation_result.scalar() or 0

    return ActivityStatsResponse(reflections=reflections, conversations=conversations)


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    tz: str | None = Query(None, description="IANA timezone id"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return the user's current streak, longest streak, and last 5 days.

    A streak is consecutive days (in the user's timezone) with at least one
    journal entry or chat session. Uses the same data source and tz logic as
    /activity/dates so the badge stays in sync with the grid.
    """
    user_tz = _valid_tz(tz)
    j_local = _local_date(JournalEntry.created_at, user_tz)
    # See /activity/dates above — chat activity is derived from individual
    # messages, not the parent session's creation timestamp, to stay in sync
    # with /mood/timeseries.
    m_local = _local_date(Message.created_at, user_tz)

    journal_dates = (
        select(j_local.label("active_date"))
        .where(JournalEntry.user_id == current_user.id)
    )
    session_dates = (
        select(m_local.label("active_date"))
        .join(Session, Session.id == Message.session_id)
        .where(
            Session.user_id == current_user.id,
            Session.source != "create",
        )
    )
    combined = union(journal_dates, session_dates).subquery()
    result = await db.execute(
        select(combined.c.active_date).distinct().order_by(combined.c.active_date)
    )
    active_dates_list = [row[0] for row in result.all()]
    active_dates_set = set(active_dates_list)

    today = _today_in_tz(user_tz)

    # ── Current streak ──────────────────────────────────────────────────
    current_streak = 0
    if today in active_dates_set:
        d = today
        while d in active_dates_set:
            current_streak += 1
            d -= timedelta(days=1)
    elif (today - timedelta(days=1)) in active_dates_set:
        # "At risk" — active yesterday but not yet today
        d = today - timedelta(days=1)
        while d in active_dates_set:
            current_streak += 1
            d -= timedelta(days=1)

    # ── Longest streak ──────────────────────────────────────────────────
    longest_streak = 0
    if active_dates_list:
        run = 1
        for i in range(1, len(active_dates_list)):
            if active_dates_list[i] - active_dates_list[i - 1] == timedelta(days=1):
                run += 1
            else:
                longest_streak = max(longest_streak, run)
                run = 1
        longest_streak = max(longest_streak, run)

    # ── Recent 5 days ───────────────────────────────────────────────────
    recent_days = []
    for i in range(5):
        d = today - timedelta(days=i)
        recent_days.append(RecentDay(
            date=d.isoformat(),
            day_letter=d.strftime("%A")[0],
            active=d in active_dates_set,
        ))

    return StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        is_today_active=today in active_dates_set,
        recent_days=recent_days,
    )
