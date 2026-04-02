"""
generate.py router — Handles image generation and selection.

FLOW:
1. User picks a concept + fills in emotion + picks a style
2. Frontend assembles the prompt and sends POST /generate
3. Backend calls DALL-E 3 four times, uploads to S3, returns URLs
4. User picks their favorite -> POST /generate/select
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.schemas.generate import (
    GenerateRequest, GenerateResponse,
    SelectImageRequest, SelectImageResponse,
)
from app.services.auth_service import get_current_user
from app.services.image_service import generate_and_store_images, select_image

router = APIRouter()


@router.post("", response_model=GenerateResponse)
async def generate_images(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),  # Auth required
):
    """
    POST /generate — Generate art from a prompt.

    Steps (handled by image_service.py):
    1. Create a new session (source="create")
    2. Run prompt through OpenAI Moderation API (safety check)
    3. Call DALL-E 3 N times (default 4)
    4. Upload each image to S3
    5. Create GeneratedImage rows in the DB
    6. Return the session ID and image URLs
    """
    result = await generate_and_store_images(
        db=db,
        user_id=current_user.id,
        prompt=request.prompt,
        style=request.style,
        concept_id=request.concept_id,
        count=request.count,
    )
    return result


@router.post("/select", response_model=SelectImageResponse)
async def select_generated_image(
    request: SelectImageRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /generate/select — Mark one image as the user's choice.

    Sets is_selected=True on the chosen image and is_selected=False
    on all other images in the same session.
    """
    await select_image(db, request.image_id, request.session_id)
    return SelectImageResponse(image_id=request.image_id)
