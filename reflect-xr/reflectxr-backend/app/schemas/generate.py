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
    """POST /generate — The full set of generated images."""
    session_id: UUID
    images: list[GeneratedImageResponse]


class SelectImageResponse(BaseModel):
    """POST /generate/select — Confirmation."""
    status: str = "ok"
    image_id: UUID
