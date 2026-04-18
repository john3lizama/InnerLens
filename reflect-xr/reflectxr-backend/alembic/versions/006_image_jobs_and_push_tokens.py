"""Add image_jobs and user_push_tokens tables.

Supports the async retry + push-notification flow added alongside the
Gemini image-gen fallback:

  - image_jobs:       row per escalated /generate request; worker
                      updates status pending -> succeeded/failed.
  - user_push_tokens: Expo push tokens registered by the mobile client.

Revision ID: 006
Revises: 005
Create Date: 2026-04-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── image_jobs ──────────────────────────────────────────────────────
    op.create_table(
        "image_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("style", sa.String(), nullable=False),
        sa.Column(
            "concept_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("count", sa.Integer(), nullable=False, server_default="4"),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    # Status is the main filter for the startup-reconcile query and
    # any future cleanup job. user_id supports "my jobs" lookups.
    op.create_index(
        "ix_image_jobs_user_id", "image_jobs", ["user_id"]
    )
    op.create_index(
        "ix_image_jobs_status", "image_jobs", ["status"]
    )

    # ── user_push_tokens ────────────────────────────────────────────────
    op.create_table(
        "user_push_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("token", name="uq_user_push_tokens_token"),
    )
    op.create_index(
        "ix_user_push_tokens_user_id", "user_push_tokens", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_push_tokens_user_id", table_name="user_push_tokens")
    op.drop_table("user_push_tokens")
    op.drop_index("ix_image_jobs_status", table_name="image_jobs")
    op.drop_index("ix_image_jobs_user_id", table_name="image_jobs")
    op.drop_table("image_jobs")
