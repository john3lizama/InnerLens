"""
message.py — The Message table.

Stores every message in a MindMate chat session — both user messages
and AI responses. Emotion tags are extracted after each exchange and
stored as JSONB on the message.

CONTEXT WINDOW: When building the LLM context, we pull the last 10
messages (5 user + 5 assistant) from this table.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Which session does this message belong to? ───────────────────────
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )

    # ── Message content ──────────────────────────────────────────────────
    # role is either "user" or "assistant" — matches OpenAI's message format
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Emotion tags ─────────────────────────────────────────────────────
    # Stored as JSON array: [{"emotion": "anxiety", "intensity": 0.8}]
    # Only populated on assistant messages (extracted after the AI responds)
    emotion_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # ── Timestamp ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ────────────────────────────────────────────────────
    session: Mapped["Session"] = relationship(back_populates="messages")
