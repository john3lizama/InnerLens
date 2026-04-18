"""
image_service.py — image generation and S3 upload.

Called from two places:
1. POST /generate       — user submits a prompt, gets 4 images
2. POST /chat/generate  — MindMate auto-generates 1 image from emotions

Provider race: each image attempt tries OpenAI (DALL·E 3) first, and
falls through to Gemini 2.5 Flash Image if OpenAI raises. If both
providers fail for the same image, we raise `AllProvidersFailed`, which
the router catches and escalates to the background retry worker
(app/workers/image_retry.py) — see Part B of the plan.

The moderation gate (check_moderation) runs upstream of the race, so
both providers see only moderation-approved prompts. Gemini's own
safety_settings (configured in providers/gemini_image.py) give us
parity with DALL·E's built-in policy on the output side.

COST NOTES:
- DALL·E 3 standard 1024×1024: ~$0.04 / image → ~$0.16 per set of 4.
- Gemini 2.5 Flash Image: free tier covers typical workloads; paid
  tier is cheaper per image than DALL·E. See
  https://ai.google.dev/pricing for current numbers.

DALL·E 3 only supports n=1 per call (unlike DALL·E 2), which is why
the loop below calls the provider four separate times.
"""

import io
import logging
import uuid

from fastapi import HTTPException
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.session import Session
from app.models.generated_image import GeneratedImage
from app.utils.storage import upload_image
from app.ai.safety import check_moderation
from app.services.providers import AllProvidersFailed, ProviderError
from app.services.providers import openai_image, gemini_image

logger = logging.getLogger(__name__)


def _make_thumbnail(image_bytes: bytes, size: tuple[int, int] = (256, 256)) -> bytes:
    """Resize image to thumbnail dimensions. Returns PNG bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    img.thumbnail(size, Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


async def _generate_one_image(prompt: str) -> dict:
    """
    Race a single image through the provider chain: OpenAI → Gemini.

    Each provider returns `{ image_bytes, revised_prompt }` or raises
    `ProviderError`. We collect errors as we go and, if every provider
    raises, re-raise them together as `AllProvidersFailed`.

    Gemini is skipped silently if its API key isn't configured — that's
    the "just use OpenAI" posture for dev environments without a Google
    account set up. In production, both keys are expected.
    """
    errors: list[ProviderError] = []

    try:
        return await openai_image.generate_image(prompt)
    except ProviderError as exc:
        errors.append(exc)
        logger.warning("OpenAI image-gen failed; falling back to Gemini: %s", exc)

    # Gemini fallback. If no key is configured, don't even attempt —
    # records the config as the "failure" reason so the router's
    # escalation logic still has something meaningful to log.
    if not settings.GEMINI_API_KEY:
        errors.append(
            ProviderError("gemini", "skipped: GEMINI_API_KEY not configured")
        )
        raise AllProvidersFailed(errors)

    try:
        return await gemini_image.generate_image(prompt)
    except ProviderError as exc:
        errors.append(exc)
        logger.error("Gemini image-gen also failed; will escalate: %s", exc)

    raise AllProvidersFailed(errors)


async def generate_and_store_images(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    style: str,
    concept_id: uuid.UUID,
    count: int = 4,
) -> dict:
    """
    Full pipeline: moderation -> provider race -> S3 upload -> DB insert.

    Returns: { session_id: uuid, images: [GeneratedImageResponse, ...] }

    Raises:
      - HTTPException(400) if the prompt is flagged by moderation.
      - AllProvidersFailed if every provider fails for any image in the
        batch. The router catches this and escalates to the async retry
        worker rather than returning a 500.
    """
    # ── Step 1: Safety check ─────────────────────────────────────────────
    # Run the prompt through OpenAI's Moderation API before generating.
    # This is FREE and catches inappropriate content before it hits any
    # image provider — parity across the OpenAI / Gemini race.
    moderation_result = await check_moderation(prompt)
    if moderation_result["flagged"]:
        raise HTTPException(
            status_code=400,
            detail="Your prompt was flagged by our content safety filter. "
                   "Please try rephrasing it.",
        )

    # ── Step 2: Create a session ─────────────────────────────────────────
    session = Session(user_id=user_id, source="create")
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # ── Step 3: Generate images ──────────────────────────────────────────
    # Combine the user's prompt with their chosen style.
    full_prompt = f"{prompt} Style: {style}."
    images = []

    for _ in range(count):
        # Race the providers for this image. On AllProvidersFailed the
        # exception propagates — the router catches it and escalates.
        result = await _generate_one_image(full_prompt)
        image_bytes = result["image_bytes"]
        revised_prompt = result["revised_prompt"]

        # ── Step 4: Upload full image and thumbnail to S3 ────────────────
        image_id = uuid.uuid4()
        s3_key = f"generated/{session.id}/{image_id}.png"
        image_url = await upload_image(image_bytes, s3_key)

        thumb_bytes = _make_thumbnail(image_bytes)
        thumb_key = f"thumbnails/{session.id}/{image_id}.png"
        thumbnail_url = await upload_image(thumb_bytes, thumb_key)

        # ── Step 5: Save to database ─────────────────────────────────────
        gen_image = GeneratedImage(
            id=image_id,
            session_id=session.id,
            image_url=image_url,
            thumbnail_url=thumbnail_url,
            prompt_used=revised_prompt,
            style_used=style,
        )
        db.add(gen_image)
        images.append(gen_image)

    await db.commit()

    return {
        "session_id": session.id,
        "images": images,
    }


async def select_image(
    db: AsyncSession, image_id: uuid.UUID, session_id: uuid.UUID
):
    """
    Mark one image as selected, deselect all others in the same session.
    """
    from sqlalchemy import update

    # Deselect all images in this session
    await db.execute(
        update(GeneratedImage)
        .where(GeneratedImage.session_id == session_id)
        .values(is_selected=False)
    )

    # Select the chosen one
    await db.execute(
        update(GeneratedImage)
        .where(GeneratedImage.id == image_id)
        .values(is_selected=True)
    )

    await db.commit()
