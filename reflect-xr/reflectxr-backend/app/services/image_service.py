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
"""

import uuid
import httpx
from fastapi import HTTPException
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.session import Session
from app.models.generated_image import GeneratedImage
from app.utils.storage import upload_image
from app.ai.safety import check_moderation

# ── OpenAI client ────────────────────────────────────────────────────────
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_and_store_images(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    style: str,
    concept_id: uuid.UUID,
    count: int = 4,
) -> dict:
    """
    Full pipeline: moderation -> DALL-E -> S3 upload -> DB insert.

    Returns: { session_id: uuid, images: [GeneratedImageResponse, ...] }
    """
    # ── Step 1: Safety check ─────────────────────────────────────────────
    # Run the prompt through OpenAI's Moderation API before generating.
    # This is FREE and catches inappropriate content before it hits DALL-E.
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
    # Combine the user's prompt with their chosen style
    full_prompt = f"{prompt} Style: {style}."
    images = []

    for _ in range(count):
        # Call DALL-E 3 (n=1 per call — that's all it supports)
        response = await client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )

        # DALL-E returns a temporary URL — download the actual image bytes
        temp_url = response.data[0].url
        revised_prompt = response.data[0].revised_prompt

        async with httpx.AsyncClient() as http:
            img_response = await http.get(temp_url)
            image_bytes = img_response.content

        # ── Step 4: Upload to S3 ─────────────────────────────────────────
        image_id = uuid.uuid4()
        s3_key = f"generated/{session.id}/{image_id}.png"
        image_url = await upload_image(image_bytes, s3_key)

        # ── Step 5: Save to database ─────────────────────────────────────
        gen_image = GeneratedImage(
            id=image_id,
            session_id=session.id,
            image_url=image_url,
            thumbnail_url=image_url,  # TODO: generate actual thumbnail
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
