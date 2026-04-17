"""
image_service.py — DALL-E 3 image generation and S3 upload.

Called from two places:
1. POST /generate       — user submits a prompt, gets 4 images
2. POST /chat/generate  — MindMate auto-generates 1 image from emotions

COST: ~$0.04 per image (standard quality, 1024x1024).
A set of 4 = ~$0.16. Budget accordingly.

KEY DALL-E 3 LIMITATION:
DALL-E 3 only supports n=1 per API call (unlike DALL-E 2).
To get 4 images, we make 4 separate API calls.

SAFETY PIPELINE (3 layers):
1. check_moderation(prompt)     — before DALL-E (text check, free)
2. DALL-E generates image
3. check_image_safety(bytes)    — after DALL-E (visual check, Rekognition)
4. Upload to S3 only if safe
"""

import asyncio
import io
import uuid
import httpx
from fastapi import HTTPException
from openai import AsyncOpenAI
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.session import Session
from app.models.generated_image import GeneratedImage
from app.utils.storage import upload_image
from app.ai.safety import check_moderation, check_image_safety

# ── OpenAI client ────────────────────────────────────────────────────────
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _make_thumbnail(image_bytes: bytes, size: tuple[int, int] = (256, 256)) -> bytes:
    """Resize image to thumbnail dimensions. Returns PNG bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    img.thumbnail(size, Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


async def generate_and_store_images(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    style: str,
    concept_id: uuid.UUID,
    count: int = 4,
) -> dict:
    """
    Full pipeline: moderation -> DALL-E -> Rekognition -> S3 upload -> DB insert.

    Returns: { session_id: uuid, images: [GeneratedImageResponse, ...] }
    """
    # ── Step 1: Safety check on prompt ──────────────────────────────────
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

    # ── Step 3: Generate images concurrently ─────────────────────────────
    # Fire all DALL-E calls at the same time instead of sequentially.
    # asyncio.gather runs them in parallel, cutting wait time from ~40s to ~10s.
    full_prompt = f"{prompt} Style: {style}."

    tasks = [_generate_single_image(full_prompt, session.id) for _ in range(count)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # ── Step 4: Save successful results to DB ────────────────────────────
    images = []
    for result in results:
        if isinstance(result, Exception):
            print(f"[image_service] Image generation failed: {result}")
            continue
        gen_image = GeneratedImage(
            id=result["image_id"],
            session_id=session.id,
            image_url=result["image_url"],
            thumbnail_url=result["thumbnail_url"],
            prompt_used=result["revised_prompt"],
            style_used=style,
        )
        db.add(gen_image)
        images.append(gen_image)

    if not images:
        raise HTTPException(
            status_code=500,
            detail="All image generation attempts failed. Please try again.",
        )

    await db.commit()

    return {
        "session_id": session.id,
        "images": images,
    }


async def _generate_single_image(full_prompt: str, session_id: uuid.UUID) -> dict:
    """
    Generate one image: DALL-E call -> Rekognition scan -> S3 upload.

    Returns dict with image_id, image_url, thumbnail_url, revised_prompt.
    Raises an exception if any step fails (caller handles via gather).
    """
    # DALL-E 3 call
    response = await client.images.generate(
        model="dall-e-3",
        prompt=full_prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )

    temp_url = response.data[0].url
    revised_prompt = response.data[0].revised_prompt

    # Download image bytes
    async with httpx.AsyncClient() as http:
        img_response = await http.get(temp_url)
        image_bytes = img_response.content

    # Layer 3: Rekognition visual safety scan
    # Run in thread pool so sync boto3 call doesn't block the event loop
    safety_result = await asyncio.to_thread(check_image_safety, image_bytes)
    if not safety_result["safe"]:
        raise Exception(
            f"Image flagged by Rekognition: {safety_result['flagged_labels']}"
        )

    # Upload to S3
    image_id = uuid.uuid4()
    s3_key = f"generated/{session_id}/{image_id}.png"
    image_url = await upload_image(image_bytes, s3_key)

    thumb_bytes = _make_thumbnail(image_bytes)
    thumb_key = f"thumbnails/{session_id}/{image_id}.png"
    thumbnail_url = await upload_image(thumb_bytes, thumb_key)

    return {
        "image_id": image_id,
        "image_url": image_url,
        "thumbnail_url": thumbnail_url,
        "revised_prompt": revised_prompt,
    }


async def select_image(
    db: AsyncSession, image_id: uuid.UUID, session_id: uuid.UUID
):
    """
    Mark one image as selected, deselect all others in the same session.
    """
    from sqlalchemy import update

    await db.execute(
        update(GeneratedImage)
        .where(GeneratedImage.session_id == session_id)
        .values(is_selected=False)
    )
    await db.execute(
        update(GeneratedImage)
        .where(GeneratedImage.id == image_id)
        .values(is_selected=True)
    )
    await db.commit()