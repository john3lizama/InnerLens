"""
database.py — Database engine, session factory, and Base class.

HOW IT WORKS:
- We create an async engine that connects to Postgres using the URL from .env
- We create a session factory (async_sessionmaker) that produces database sessions
- We define a Base class that all our SQLAlchemy models inherit from
- We provide a `get_db` dependency that FastAPI routes use to get a DB session

WHY ASYNC:
- FastAPI is async by default. Using async DB sessions means our API can handle
  multiple requests at the same time without blocking (e.g., while waiting for
  a DALL-E image to generate, other users can still hit the API).
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# ── Create the async engine ──────────────────────────────────────────────────
# The engine is the low-level connection to Postgres.
# `echo=True` prints every SQL query to the console — helpful during development,
# turn it off in production by setting echo=False.
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# ── Create a session factory ─────────────────────────────────────────────────
# A "session" is a conversation with the database. Each API request gets its own
# session, uses it to read/write data, then closes it.
# `expire_on_commit=False` means we can still access object attributes after
# committing without triggering a lazy load (which would fail in async).
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Base class for all models ────────────────────────────────────────────────
# Every model (User, Concept, etc.) inherits from this.
# SQLAlchemy uses this to know which tables to create.
class Base(DeclarativeBase):
    pass


# ── Dependency: get a DB session for each request ────────────────────────────
# FastAPI's Depends() system calls this function automatically.
# The `yield` keyword means:
#   1. Create a session and give it to the route
#   2. When the route finishes, close the session (cleanup)
# If something crashes, the session still gets closed (the finally block).
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
