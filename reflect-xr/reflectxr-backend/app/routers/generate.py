"""
generate.py router — Handles image generation and selection.

FLOW (with fallback chain):
  1. Client posts prompt/style/concept.
  2. Moderation check (OpenAI's free API).
  3. Sync race: OpenAI DALL·E 3 → Gemini 2.5 Flash Image. If either
     succeeds for every image in the batch, return 200 with the image set.
  4. If both providers fail on any image, we create an `image_jobs` row,
     spawn the background retry worker, and return 202 with a `job_id`.
     The client polls `GET /generate/status/{job_id}` (and/or waits for
     the "your image is ready" push notification) until `succeeded` or
     `failed`.

ENDPOINTS
  POST   /generate                          — kick off generation
  GET    /generate/status/{job_id}          — poll retry job
  POST   /generate/select                   — mark chosen image
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.generated_image import GeneratedImage
from app.models.image_job import ImageJob
from app.schemas.generate import (
    GenerateRequest,
    GenerateResponse,
    GeneratePendingResponse,
    JobStatusResponse,
    GeneratedImageResponse,
    SelectImageRequest,
    SelectImageResponse,
)
from app.services.auth_service import get_current_user
from app.services.image_service import generate_and_store_images, select_image
from app.services.providers import AllProvidersFailed
from app.workers.image_retry import schedule_retry

router = APIRouter()


@router.post(
    "",
    # Two possible success responses — `response_model` covers the 200
    # case; the 202 body is documented via `responses` so /docs stays
    # accurate. Implementation returns a raw JSONResponse for the 202
    # path to control the status code.
    response_model=GenerateResponse,
    responses={
        202: {
            "model": GeneratePendingResponse,
            "description": "Both providers are unavailable; a background "
                           "retry has been scheduled. Poll "
                           "/generate/status/{job_id} or wait for a push "
                           "notification.",
        },
    },
)
async def generate_images(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /generate — Generate art from a prompt.

    Happy path: moderation → OpenAI → S3 → DB → 200 with the images.
    OpenAI down: fall through to Gemini transparently (same 200 shape).
    Both down: create an `image_jobs` row + spawn the retry worker and
               return 202 with a job_id.
    """
    try:
        result = await generate_and_store_images(
            db=db,
            user_id=current_user.id,
            prompt=request.prompt,
            style=request.style,
            concept_id=request.concept_id,
            count=request.count,
        )
        return result

    except AllProvidersFailed as exc:
        # Stage the retry job. We store the prompt with style already
        # interpolated (same string image_service would have sent to
        # either provider) so the worker retries the exact same input.
        full_prompt = f"{request.prompt} Style: {request.style}."
        job = ImageJob(
            user_id=current_user.id,
            prompt=full_prompt,
            style=request.style,
            concept_id=request.concept_id,
            count=request.count,
            error=str(exc),
            status="pending",
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        schedule_retry(job.id)

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"status": "pending", "job_id": str(job.id)},
        )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /generate/status/{job_id} — Poll an escalated generation job.

    The mobile client polls this every ~10 s while showing the
    "Image generation is taking longer than expected..." copy. Also
    used by the notification-tap flow to hydrate ResponseScreen with
    the finished images (the notification payload carries the job_id).
    """
    job = await db.get(ImageJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != current_user.id:
        # Don't leak existence. Same 404 as a missing job.
        raise HTTPException(status_code=404, detail="Job not found")

    # For a succeeded job, join in the images the worker produced.
    images: list[GeneratedImageResponse] = []
    if job.status == "succeeded" and job.session_id is not None:
        stmt = (
            select(GeneratedImage)
            .where(GeneratedImage.session_id == job.session_id)
            .order_by(GeneratedImage.created_at.asc())
        )
        rows = (await db.execute(stmt)).scalars().all()
        images = [GeneratedImageResponse.model_validate(r) for r in rows]

    return JobStatusResponse(
        status=job.status,
        session_id=job.session_id,
        images=images,
        error=job.error,
    )


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
