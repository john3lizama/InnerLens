"""
main.py — FastAPI application entry point for ReflectXR.

This is the file that uvicorn runs. It:
1. Creates the FastAPI app instance
2. Adds CORS middleware (allows React Native to talk to the API)
3. Registers all 5 routers with their URL prefixes
4. Provides a /health endpoint for Docker health checks

Run locally:  uvicorn app.main:app --reload
Run in Docker: docker-compose up  (see docker-compose.yml)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Import all routers ──────────────────────────────────────────────────
# Each router handles one area of the API. They're defined in app/routers/
from app.routers import auth, concepts, generate, chat, journal, alexa


# ══════════════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="ReflectXR API",
    version="0.1.0",
    description="Backend API for ReflectXR — emotion-driven art generation",
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
