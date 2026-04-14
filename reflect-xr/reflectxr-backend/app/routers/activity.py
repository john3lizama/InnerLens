"""
activity.py router — User activity tracking for the profile grid.

Single endpoint that returns all dates in a given year where the user
had at least one journal entry or chat session (in-app, Alexa, or HomePod).
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, union, func, cast, Date, extract
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models.journal_entry import JournalEntry
from app.models.session import Session
from app.schemas.activity import (
    ActivityDatesResponse, ActivityStatsResponse,
    StreakResponse, RecentDay,
)
from app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/dates", response_model=ActivityDatesResponse)
async def get_activity_dates(
    year: int = Query(..., ge=2020, le=2100, description="Year to fetch activity for"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return all dates in a given year where the user was active.

    A day counts as active if the user:
    - Saved at least one journal reflection, OR
    - Had at least one chat session (in-app MindMate, Alexa, or HomePod)

    Returns a sorted list of date strings in YYYY-MM-DD format.
    """
    # Distinct dates from journal entries
    journal_dates = (
        select(cast(JournalEntry.created_at, Date).label("active_date"))
        .where(
            JournalEntry.user_id == current_user.id,
            extract("year", JournalEntry.created_at) == year,
        )
    )

    # Distinct dates from chat sessions (source != 'create')
    session_dates = (
        select(cast(Session.created_at, Date).label("active_date"))
        .where(
            Session.user_id == current_user.id,
            Session.source != "create",
            extract("year", Session.created_at) == year,
        )
    )

    # Union both, get distinct, sort
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
    # Count journal entries
    reflection_result = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.user_id == current_user.id
        )
    )
    reflections = reflection_result.scalar() or 0

    # Count chat sessions (source != 'create')
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
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return the user's current streak, longest streak, and last 5 days.

    A streak is consecutive days with at least one journal entry or chat session.
    Uses the same data source as /activity/dates to stay in sync with the grid.
    """
    # ── Fetch ALL active dates (no year filter) ─────────────────────────
    journal_dates = (
        select(cast(JournalEntry.created_at, Date).label("active_date"))
        .where(JournalEntry.user_id == current_user.id)
    )
    session_dates = (
        select(cast(Session.created_at, Date).label("active_date"))
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

    today = date.today()

    # ── Current streak ──────────────────────────────────────────────────
    current_streak = 0
    if today in active_dates_set:
        # Count consecutive days backward from today
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
            day_letter=d.strftime("%A")[0],  # "M", "T", "W", etc.
            active=d in active_dates_set,
        ))

    return StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        is_today_active=today in active_dates_set,
        recent_days=recent_days,
    )
