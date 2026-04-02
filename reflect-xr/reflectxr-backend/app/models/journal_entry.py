"""
journal_entry.py — The JournalEntry table.

After a user selects their favorite generated image, they write a reflection.
This table stores that reflection text along with:
- The image they chose
- The session it came from
- Emotion tags extracted from their writing (NLP requirement R5)
- The reflection prompt that guided their writing
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign keys ─────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generated_images.id"), nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )

    # ── Journal content ──────────────────────────────────────────────────
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # The reflection question that was shown to the user when they wrote this
    # Example: "What helps this feeling soften and settle over time?"
    reflection_prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Emotion tags (NLP requirement R5) ────────────────────────────────
    # After saving, emotion_service.py runs on the content and stores tags here.
    # Same format as messages: [{"emotion": "hope", "intensity": 0.6}]
    emotion_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Word count — calculated on save, useful for the journal list view
    word_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Timestamps ───────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="journal_entries")
    image: Mapped["GeneratedImage"] = relationship()
