"""Initial schema — all tables.

Revision ID: 001
Revises:
Create Date: 2026-04-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("preferred_style", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── concepts ─────────────────────────────────────────────────────────
    op.create_table(
        "concepts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("prompt_template", sa.Text(), nullable=False),
        sa.Column("dropdown_label", sa.String(), nullable=False),
        sa.Column("dropdown_options", postgresql.JSONB(), nullable=False),
        sa.Column("reflection_prompt", sa.Text(), nullable=False),
        sa.Column("category", sa.String(), server_default="core"),
    )

    # ── styles ───────────────────────────────────────────────────────────
    op.create_table(
        "styles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("category", sa.String(), nullable=False),
    )

    # ── sessions ─────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("source", sa.String(), nullable=False, server_default="create"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── messages ─────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("emotion_tags", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── generated_images ─────────────────────────────────────────────────
    op.create_table(
        "generated_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=False,
        ),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("prompt_used", sa.Text(), nullable=False),
        sa.Column("style_used", sa.String(), nullable=False),
        sa.Column("is_selected", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── journal_entries ───────────────────────────────────────────────────
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "image_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generated_images.id"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("reflection_prompt_used", sa.Text(), nullable=True),
        sa.Column("emotion_tags", postgresql.JSONB(), nullable=True),
        sa.Column("word_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("journal_entries")
    op.drop_table("generated_images")
    op.drop_table("messages")
    op.drop_table("sessions")
    op.drop_table("styles")
    op.drop_table("concepts")
    op.drop_table("users")
