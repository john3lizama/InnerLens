"""
journal.py schemas — Validates data for /journal endpoints.

Journal entries are reflections the user writes after selecting their
favorite generated image. Emotion tags are extracted automatically
from the text using NLP (requirement R5).
"""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.schemas.chat import EmotionTag


# ── Request schemas ──────────────────────────────────────────────────────

class JournalCreateRequest(BaseModel):
    """POST /journal — Save a new journal entry."""
    image_id: UUID                            # The selected image
    session_id: UUID                          # The session it came from
    content: str                              # The user's reflection text
    reflection_prompt_used: str | None = None  # Which question was shown


# ── Response schemas ─────────────────────────────────────────────────────

class JournalImageSummary(BaseModel):
    """Nested image info shown in journal list/detail views."""
    id: UUID
    image_url: str
    thumbnail_url: str | None = None

    model_config = {"from_attributes": True}


class JournalCreateResponse(BaseModel):
    """POST /journal — Confirmation with extracted emotion tags."""
    id: UUID
    created_at: datetime
    emotion_tags: list[EmotionTag]
    word_count: int


class JournalListItem(BaseModel):
    """One entry in the GET /journal list (content truncated to 100 chars)."""
    id: UUID
    content: str                    # Truncated to 100 characters
    emotion_tags: list[EmotionTag]
    image: JournalImageSummary
    created_at: datetime
    word_count: int


class JournalListResponse(BaseModel):
    """GET /journal — Paginated list of entries."""
    entries: list[JournalListItem]
    total: int


class JournalDetailResponse(BaseModel):
    """GET /journal/:id — Full journal entry."""
    id: UUID
    content: str                    # Full text (not truncated)
    emotion_tags: list[EmotionTag]
    image: JournalImageSummary
    reflection_prompt_used: str | None
    created_at: datetime
    word_count: int
