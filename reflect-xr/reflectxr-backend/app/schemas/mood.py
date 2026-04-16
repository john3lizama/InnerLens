"""
mood.py schemas — Response types for the /mood endpoints.

The mood graph on Home shows a stacked pill per day: every day fills
100% of the chart height, segmented vertically by each emotion's
intensity-weighted share. Per-day shares always sum to ~1.0.
"""

from pydantic import BaseModel


class EmotionShare(BaseModel):
    """One emotion's share of a given day.

    Backend aggregates per-entry `emotion_tags` intensities from both
    messages and journals, then normalizes to shares within the day.
    The client buckets `emotion` via substring rules and stacks colored
    segments proportional to `share`.
    """
    emotion: str     # lowercased raw label from GPT-4o-mini
    share: float     # 0.0..1.0, shares within a day sum to ~1.0
    valence: int     # -1 / 0 / +1 via valence_of()


class MoodDay(BaseModel):
    """One day in the mood timeseries. Days with no activity are omitted
    entirely (a missing day is not a neutral day)."""
    date: str                      # YYYY-MM-DD in the caller's timezone
    emotions: list[EmotionShare]   # sorted by share desc; always non-empty


class MoodTimeseriesResponse(BaseModel):
    """GET /mood/timeseries — days + gating counts so the client knows
    whether to show the real graph or the example/locked state."""
    days: list[MoodDay]
    conversation_count: int   # total 'chat' sessions for user
    journal_count: int        # total journals for user
    unlocked: bool            # conversation_count + journal_count >= 3
