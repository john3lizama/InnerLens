"""
image_job.py — Tracks an in-flight image-generation job when both OpenAI
and Gemini failed on the sync path and we escalated to the background
retry worker (app/workers/image_retry.py).

LIFECYCLE:
  pending   — row created immediately when /generate's sync path fails;
              the retry worker picks it up and cycles through providers.
  succeeded — worker produced all `count` images; they were written to
              S3 + GeneratedImage rows under `session_id`. Push sent.
  failed    — worker exhausted IMAGE_RETRY_CYCLES without success;
              `error` holds the last provider's message. Push sent.

ROWS NEVER GET DELETED: mobile polls `/generate/status/{job_id}` by
job_id, and the notification tap also deep-links to ResponseScreen with
the job_id, so both need the row to persist. A future cleanup job can
prune rows older than N days if volume gets noisy.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class ImageJob(Base):
    __tablename__ = "image_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Ownership ────────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # ── Generation parameters (so the worker can retry w/o the client) ──
    # We store everything the sync path would need to retry: the full
    # prompt (style already interpolated — this is the exact string sent
    # to the provider), the chosen style name (for the image row's
    # `style_used` column), the concept id, and how many images to make.
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    style: Mapped[str] = mapped_column(String, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    # ── Result linkage ──────────────────────────────────────────────────
    # Populated when the job succeeds and the worker creates the Session
    # / GeneratedImage rows. Nullable because `pending` and `failed` jobs
    # don't have one. The `/generate/status/{job_id}` endpoint joins on
    # this to return the actual image URLs.
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True
    )

    # ── Status + diagnostics ────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default="pending", index=True
    )  # 'pending' | 'succeeded' | 'failed'
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ──────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
