"""
email_verification.py — Stores 4-digit codes for email change verification.

Each code is valid for 10 minutes. When the user requests an email change,
a code is generated, stored here, and emailed to the NEW address. The user
enters the code to confirm they own that email.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # The user requesting the change
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # The NEW email they want to switch to
    new_email: Mapped[str] = mapped_column(String, nullable=False)

    # 4-digit verification code
    code: Mapped[str] = mapped_column(String(4), nullable=False)

    # Expiry and usage tracking
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
