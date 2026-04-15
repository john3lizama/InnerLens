"""
mood.py schemas — Response types for the /mood endpoints.

The mood graph on Home collapses hundreds of per-message emotion tags into
one glanceable trend: per day, one dominant emotion + its intensity + a
signed valence. The client draws a bar per day, direction = valence sign.
"""

from pydantic import BaseModel


class MoodDay(BaseModel):
    """One day in the mood timeseries. Days with no activity are omitted
    entirely (a missing day is not a neutral day)."""
    date: str               # YYYY-MM-DD in the caller's timezone
    dominant_emotion: str   # lowercase; member of EMOTION_VALENCE (usually)
    intensity: float        # 0.0..1.0 — average intensity for the dominant
    valence: int            # -1 / 0 / +1 from EMOTION_VALENCE


class MoodTimeseriesResponse(BaseModel):
    """GET /mood/timeseries — days + gating counts so the client knows
    whether to show the real graph or the example/locked state."""
    days: list[MoodDay]
    conversation_count: int   # total 'chat' sessions for user
    journal_count: int        # total journals for user
    unlocked: bool            # conversation_count + journal_count >= 3
