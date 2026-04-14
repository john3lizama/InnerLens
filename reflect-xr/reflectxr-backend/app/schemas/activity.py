"""
activity.py schemas — Response for the /activity endpoints.
"""

from pydantic import BaseModel


class ActivityDatesResponse(BaseModel):
    """GET /activity/dates — List of dates the user was active."""
    dates: list[str]


class ActivityStatsResponse(BaseModel):
    """GET /activity/stats — Aggregate counts for the profile."""
    reflections: int
    conversations: int


class RecentDay(BaseModel):
    """A single day in the streak popup's 5-day history."""
    date: str
    day_letter: str    # "M", "T", "W", etc.
    active: bool


class StreakResponse(BaseModel):
    """GET /activity/streak — Current streak info for the fire badge."""
    current_streak: int
    longest_streak: int
    is_today_active: bool
    recent_days: list[RecentDay]  # last 5 days, today first
