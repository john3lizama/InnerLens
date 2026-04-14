"""
pending_registration.py — Stores registration data server-side until email is verified.

When a user taps "Create Account," we hash their password and store it here
alongside a 4-digit verification code. The actual User row is only created
after the code is verified. This prevents orphaned unverified accounts and
ensures the password only crosses the wire once.

Security:
- Password is stored as a bcrypt hash (never plain text)
- Code is generated with secrets.randbelow() (cryptographically secure)
- Code expires after 10 minutes
- Max 5 verification attempts per code
- Max 3 code requests per email per hour (rate limiting)
- Old pending registrations for the same email are cleaned up on new requests
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Registration data — stored server-side so step 2 only needs email + code
    email: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)

    # 4-digit verification code (cryptographically generated)
    code: Mapped[str] = mapped_column(String(4), nullable=False)

    # Expiry and usage tracking
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
