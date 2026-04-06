"""
session.py — The Session table.

A session groups a set of related actions together. There are two types:
- source="create" — user went through the Concept -> Prompt -> Generate flow
- source="chat"   — user had a MindMate conversation that triggered art

Sessions link to Messages (chat history) and GeneratedImages.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign key to the user who started this session ─────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # ── Session type ─────────────────────────────────────────────────────
    # "create" = concept art flow, "chat" = MindMate conversation
    source: Mapped[str] = mapped_column(String, nullable=False, default="create")

    # ── Timestamps ───────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    images: Mapped[list["GeneratedImage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["JournalEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
