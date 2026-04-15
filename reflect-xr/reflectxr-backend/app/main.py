"""
main.py — FastAPI application entry point for ReflectXR.

This is the file that uvicorn runs. It:
1. Creates the FastAPI app instance
2. Adds CORS middleware (allows React Native to talk to the API)
3. Registers all 5 routers with their URL prefixes
4. Provides a /health endpoint for Docker health checks
5. Starts the APScheduler background loop for the chat retention job

Run locally:  uvicorn app.main:app --reload
Run in Docker: docker-compose up  (see docker-compose.yml)
"""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import async_session
from app.jobs.retention import purge_stale_chat_sessions

# ── Import all routers ──────────────────────────────────────────────────
# Each router handles one area of the API. They're defined in app/routers/
from app.routers import auth, concepts, generate, chat, journal, alexa, activity, mood

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════
# BACKGROUND JOBS (lifespan)
# ══════════════════════════════════════════════════════════════════════════
# APScheduler runs inside the FastAPI event loop. One cron job: the chat
# retention purge, which deletes MindMate sessions inactive for 18 months
# and not anchored by a journal entry. See app/jobs/retention.py.
#
# Single-replica safe. If we ever scale out, wrap the job body in a
# pg_try_advisory_lock so only one replica actually runs it.

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        purge_stale_chat_sessions,
        trigger="cron",
        hour=3,
        minute=0,
        kwargs={"db_session_factory": async_session},
        id="chat_retention",
        misfire_grace_time=3600,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("retention: scheduler started (chat_retention @ 03:00 UTC daily)")
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("retention: scheduler stopped")


# ══════════════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="ReflectXR API",
    version="0.1.0",
    description="Backend API for ReflectXR — emotion-driven art generation",
    lifespan=lifespan,
)

# ── CORS Middleware ──────────────────────────────────────────────────────
# CORS = Cross-Origin Resource Sharing. Browsers block requests from
# different origins by default. Since our React Native app runs on a
# different port/domain than the API, we need to allow it.
#
# allow_origins=["*"] means "accept requests from anywhere."
# For production, you'd restrict this to your app's domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════
# REGISTER ROUTERS
# ══════════════════════════════════════════════════════════════════════════
# Each router gets a URL prefix. So auth.router's "/register" endpoint
# becomes "/auth/register" in the full API.

app.include_router(auth.router,     prefix="/auth",     tags=["Auth"])
app.include_router(concepts.router, prefix="/concepts", tags=["Concepts"])
app.include_router(generate.router, prefix="/generate", tags=["Generate"])
app.include_router(chat.router,     prefix="/chat",     tags=["Chat"])
app.include_router(journal.router,  prefix="/journal",  tags=["Journal"])
app.include_router(alexa.router,    prefix="/alexa",    tags=["Alexa"])
app.include_router(activity.router, prefix="/activity", tags=["Activity"])
app.include_router(mood.router,     prefix="/mood",     tags=["Mood"])


# ══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Simple health check endpoint.

    Docker uses this to know if the container is alive.
    Also useful for debugging — hit http://localhost:8000/health
    and if you get {"status": "ok"} the API is running.
    """
    return {"status": "ok", "service": "reflectxr-api"}
