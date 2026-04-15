"""Chat-session retention job.

Purges MindMate chat sessions that have been inactive for RETENTION_DAYS
and have no journal entries anchoring them to permanence. A chat session
with even one linked journal entry is kept indefinitely — that journal is
the user's work and we don't want to silently strip the conversation
context behind it.

A session is considered "inactive" if its most recent Message is older
than the cutoff. If a session somehow has no messages at all (shouldn't
happen via the API, but defensive here), we fall back to session.created_at.

Scheduled from app.main via APScheduler. Safe to call directly from a
Python shell or a test — the function is a pure coroutine that takes the
db session factory and commits its own transaction.

Single-replica deploy note
--------------------------
APScheduler runs in every replica. If we ever scale out, wrap the job
body in SELECT pg_try_advisory_lock(<const>) so only one replica actually
does the work. Not needed today.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models.journal_entry import JournalEntry
from app.models.message import Message
from app.models.session import Session

logger = logging.getLogger(__name__)

# ~18 months of inactivity before purge. The plan fixed this at 18 months;
# using 30-day months is a deliberate approximation — the cutoff is not
# calendar-precise and users get a bit of slack on the boundary.
RETENTION_DAYS = 18 * 30


async def purge_stale_chat_sessions(db_session_factory) -> int:
    """Delete inactive, unanchored chat sessions. Returns the count purged.

    Parameters
    ----------
    db_session_factory:
        An ``async_sessionmaker`` (e.g., ``app.db.database.async_session``).
        Passed in rather than imported so tests can substitute an override.
    """
    # Session.created_at / Message.created_at are TIMESTAMP WITHOUT TIME ZONE
    # (stored as naive UTC — see app/models/session.py). Asyncpg refuses to
    # bind a tz-aware value to a naive column, so we compute the cutoff in
    # UTC and then drop the tzinfo before comparison.
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).replace(tzinfo=None)

    async with db_session_factory() as db:
        # Sessions that have at least one linked journal → keep forever.
        journaled_sessions = select(JournalEntry.session_id).distinct().subquery()

        # Most recent message per session (null if none).
        latest_msg = (
            select(
                Message.session_id.label("session_id"),
                func.max(Message.created_at).label("last_at"),
            )
            .group_by(Message.session_id)
            .subquery()
        )

        stmt = (
            select(Session)
            .outerjoin(latest_msg, Session.id == latest_msg.c.session_id)
            .where(
                Session.source == "chat",
                Session.id.not_in(select(journaled_sessions.c.session_id)),
                func.coalesce(latest_msg.c.last_at, Session.created_at) < cutoff,
            )
        )
        stale = (await db.execute(stmt)).scalars().all()
        count = len(stale)

        # ORM-level delete so the cascade on Session.messages / images /
        # journal_entries fires. (We've already excluded sessions with
        # journals, so that last cascade is a no-op by construction.)
        for s in stale:
            await db.delete(s)
        await db.commit()

        if count:
            logger.info("retention: purged %d stale chat sessions", count)
        else:
            logger.info("retention: no stale chat sessions to purge")
        return count
