"""
conftest.py — Shared pytest fixtures for ReflectXR tests.

Integration tests against a real Postgres instance.

    docker-compose exec api python -m pytest tests/ -v

NullPool is used so every fixture gets its own fresh connection,
avoiding asyncpg "operation in progress" errors from pool sharing.
"""

import asyncio

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import app.models  # noqa: F401 — registers all models with Base
from app.config import settings
from app.db.database import Base, get_db
from app.main import app

DATABASE_URL = settings.DATABASE_URL

_engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
_TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

_TRUNCATE_TABLES = [
    "journal_entries",
    "generated_images",
    "messages",
    "sessions",
    "users",
    "concepts",
    "styles",
]


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop required for session-scoped async fixtures."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once; drop them after the full test run."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """Provide a session; truncate all data after each test."""
    async with _TestSession() as session:
        yield session
    # Cleanup in a fresh session so committed data from the test is removed
    async with _TestSession() as session:
        for table in _TRUNCATE_TABLES:
            await session.execute(text(f"TRUNCATE {table} CASCADE"))
        await session.commit()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    """HTTP client wired to the FastAPI app with the test DB session."""
    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
