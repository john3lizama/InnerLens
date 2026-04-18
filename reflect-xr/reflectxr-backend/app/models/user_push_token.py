"""
user_push_token.py — Expo push tokens registered by authenticated users.

One row per (user, token). Multiple devices per user are supported
(the same user may be logged in on iPhone + iPad, each with its own
token). Revocation is soft — we set `revoked_at` instead of deleting,
both for audit and to survive "device reinstall" → "Expo reissues the
same token" without creating a duplicate-key violation.

The Expo Push relay occasionally returns `DeviceNotRegistered` for
tokens that have gone stale (user uninstalled, logged out elsewhere,
etc.). The notification service catches that and soft-deletes the row
so we don't keep retrying a dead endpoint.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class UserPushToken(Base):
    __tablename__ = "user_push_tokens"
    # A single physical device has a single Expo token. If the same token
    # comes in for a different user (handoff / account switch on a shared
    # device), we move ownership by soft-deleting the old row and inserting
    # a new one — enforced at the token column (unique) rather than across
    # the pair.
    __table_args__ = (
        UniqueConstraint("token", name="uq_user_push_tokens_token"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String, nullable=False)
    platform: Mapped[str] = mapped_column(String, nullable=False)  # 'ios' | 'android'

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
