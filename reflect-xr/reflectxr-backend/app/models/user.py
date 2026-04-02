"""
user.py — The User table.

Each row is one registered user. Stores their email, hashed password,
display name, and optional preferred art style.

RELATIONSHIPS:
- A user has many Sessions (chat sessions and generate sessions)
- A user has many JournalEntries
"""

import uuid
from datetime import datetime
from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    # ── Primary key ──────────────────────────────────────────────────────
    # UUID is better than auto-increment integers for APIs because:
    # 1. IDs can't be guessed (security)
    # 2. IDs can be generated client-side if needed
    # 3. No collisions when merging databases
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── User fields ──────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)

    # NEVER store plain-text passwords. This holds the bcrypt hash.
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)

    # Optional: user's favorite art style (e.g., "Watercolor")
    preferred_style: Mapped[str | None] = mapped_column(String, nullable=True)

    # ── Timestamps ───────────────────────────────────────────────────────
    # server_default=func.now() means Postgres sets the time, not Python.
    # This is more reliable because the DB clock is the single source of truth.
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    # back_populates creates a two-way link: user.sessions and session.user
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    journal_entries: Mapped[list["JournalEntry"]] = relationship(back_populates="user")
