"""
generated_image.py — The GeneratedImage table.

Each row is one DALL-E generated image. A typical generate session produces 4 images.
The user selects one (is_selected=True), and the rest stay in the DB but unselected.

IMAGE STORAGE:
- image_url:     full-size image in S3 (1024x1024)
- thumbnail_url: smaller version for list views
- S3 key pattern: generated/{session_id}/{image_id}.png
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class GeneratedImage(Base):
    __tablename__ = "generated_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Which session produced this image? ───────────────────────────────
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )

    # ── Image URLs in S3 ────────────────────────────────────────────────
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # ── What prompt was actually used? ───────────────────────────────────
    # DALL-E 3 rewrites your prompt internally. The `revised_prompt` from
    # OpenAI's response is what it actually used. We store both for debugging.
    prompt_used: Mapped[str] = mapped_column(Text, nullable=False)
    style_used: Mapped[str] = mapped_column(String, nullable=False)

    # ── Selection ────────────────────────────────────────────────────────
    # Only one image per session can be selected (the user's choice)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Timestamps ───────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ── Relationships ────────────────────────────────────────────────────
    session: Mapped["Session"] = relationship(back_populates="images")
