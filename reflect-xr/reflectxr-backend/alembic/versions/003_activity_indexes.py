"""Add activity-query indexes on journal_entries and sessions.

These indexes back the /activity/dates and /activity/streak endpoints, which
UNION distinct dates from both tables scoped to one user. The composite
(user_id, created_at) layout lets Postgres serve the scan from the index,
already ordered — so the DISTINCT/ORDER BY at the end is effectively free.

The sessions index is partial (source <> 'create') to match the query's
WHERE clause and stay compact.

Deploy note
-----------
This migration uses ordinary CREATE INDEX (locks writers briefly). For our
current data volume (thousands of rows at most) this is sub-second.

For a future production deploy against a large table, run this manually
outside Alembic with CONCURRENTLY to avoid the write lock:

    CREATE INDEX CONCURRENTLY idx_journal_entries_user_created
      ON journal_entries (user_id, created_at);
    CREATE INDEX CONCURRENTLY idx_sessions_user_created_active
      ON sessions (user_id, created_at) WHERE source <> 'create';

…then stamp Alembic forward with `alembic stamp 003`.

Revision ID: 003
Revises: 002
Create Date: 2026-04-14
"""

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_journal_entries_user_created",
        "journal_entries",
        ["user_id", "created_at"],
        if_not_exists=True,
    )
    # Partial index: only rows that actually count as "active" for the
    # activity/streak queries (source != 'create'). Keeps the index smaller
    # and removes any need for the planner to filter by source on read.
    op.create_index(
        "idx_sessions_user_created_active",
        "sessions",
        ["user_id", "created_at"],
        postgresql_where="source <> 'create'",
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_sessions_user_created_active", table_name="sessions", if_exists=True)
    op.drop_index("idx_journal_entries_user_created", table_name="journal_entries", if_exists=True)
