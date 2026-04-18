"""
generate.py schemas — Validates data for /generate endpoints.

POST /generate:        User submits a prompt -> gets back 4 images
POST /generate/select: User picks their favorite image from the 4
"""

from pydantic import BaseModel, Field
from uuid import UUID


# ── Request schemas ──────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    """POST /generate — Trigger DALL-E image generation."""
    prompt: str                           # The assembled prompt text
    style: str                            # Art style name (e.g., "Watercolor")
    concept_id: UUID                      # Which concept this came from
    count: int = Field(default=4, ge=1, le=4)  # How many images (1-4, default 4)


class SelectImageRequest(BaseModel):
    """POST /generate/select — Mark one image as the user's choice."""
    image_id: UUID
    session_id: UUID


# ── Response schemas ─────────────────────────────────────────────────────

class GeneratedImageResponse(BaseModel):
    """One image in the generation results."""
    id: UUID
    image_url: str
    thumbnail_url: str | None
    prompt_used: str           # What DALL-E actually used (revised prompt)
    style_used: str

    model_config = {"from_attributes": True}


class GenerateResponse(BaseModel):
    """POST /generate — The full set of generated images (status 200)."""
    session_id: UUID
    images: list[GeneratedImageResponse]


class GeneratePendingResponse(BaseModel):
    """
    POST /generate — Returned with status 202 when both OpenAI and Gemini
    failed on the sync path. The request has been queued for the
    background retry worker. Client polls GET /generate/status/{job_id}
    for completion and/or waits for a push notification.
    """
    status: str = "pending"
    job_id: UUID


class JobStatusResponse(BaseModel):
    """
    GET /generate/status/{job_id} — Tracks an escalated retry.

    - status == "pending"   — still retrying; poll again later.
    - status == "succeeded" — `session_id` + `images` are populated.
    - status == "failed"    — `error` holds the last provider's message.
    """
    status: str  # 'pending' | 'succeeded' | 'failed'
    session_id: UUID | None = None
    images: list[GeneratedImageResponse] = []
    error: str | None = None


class SelectImageResponse(BaseModel):
    """POST /generate/select — Confirmation."""
    status: str = "ok"
    image_id: UUID
