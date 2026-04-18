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
    image: JournalImageSummary | None
    created_at: datetime
    word_count: int
    is_favorite: bool = False


class JournalListResponse(BaseModel):
    """GET /journal — Paginated list of entries."""
    entries: list[JournalListItem]
    total: int


class JournalDetailResponse(BaseModel):
    """GET /journal/:id — Full journal entry."""
    id: UUID
    content: str                    # Full text (not truncated)
    emotion_tags: list[EmotionTag]
    image: JournalImageSummary | None
    reflection_prompt_used: str | None
    created_at: datetime
    word_count: int
    is_favorite: bool = False


# ── Mutation schemas ─────────────────────────────────────────────────────

class JournalFavoriteUpdate(BaseModel):
    """PATCH /journal/:id/favorite — Toggle the favorite flag."""
    is_favorite: bool


class JournalContentUpdate(BaseModel):
    """
    PATCH /journal/:id — Update the text of a journal entry.

    The mobile client's "edit reflection" flow sends only the content; we
    re-run emotion extraction + recompute `word_count` server-side so the
    stored tags stay in sync with the text. No other fields are editable
    (image, session, and timestamps are immutable once the entry exists).
    """
    content: str
