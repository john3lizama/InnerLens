"""Add profile_image_url to users table.

Revision ID: 002
Revises: 001
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image_url")
