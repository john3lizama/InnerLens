"""
openai_image.py — DALL·E 3 adapter.

Extracted from the original `image_service.generate_and_store_images` so
the same call can be reused on the sync path and from the async retry
worker (app/workers/image_retry.py). Shape is the standard provider
contract: returns `{ image_bytes, revised_prompt }` or raises
`ProviderError`.

Timeout is set explicitly at 25 s so we fall through to Gemini quickly
when OpenAI is slow — the default (30 s) is fine for the sync path but
compounds badly across 4 images when OpenAI is degraded.
"""

import httpx
from openai import AsyncOpenAI
from app.config import settings
from app.services.providers import ProviderError

# Module-level client — reuses the HTTP connection pool across calls.
# `timeout=25.0` applies to every HTTP call the SDK makes (including the
# /images/generations POST) and is half a second shy of our downstream
# backoff so a hung OpenAI doesn't push us over the 30 s we reserve per
# provider attempt.
_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=25.0)


async def generate_image(prompt: str) -> dict:
    """
    Generate a single 1024×1024 image via DALL·E 3.

    DALL·E 3 only supports n=1, so callers that want multiple images
    (the /generate endpoint wants 4) call this once per image — the
    sync path does this sequentially today.

    Returns:
        {
            "image_bytes": bytes,       # raw PNG
            "revised_prompt": str,      # DALL·E's rewritten prompt
        }

    Raises:
        ProviderError: on any SDK/HTTP/content-policy failure. The
            `message` field carries the underlying error text so logs
            can reconstruct why we fell back to Gemini.
    """
    try:
        response = await _client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
    except Exception as exc:
        # OpenAI SDK wraps HTTP errors, policy rejections, and rate
        # limits in its own exception hierarchy; we flatten them all
        # to ProviderError so the race logic stays simple.
        raise ProviderError("openai", f"generate failed: {exc}") from exc

    if not response.data:
        raise ProviderError("openai", "empty response.data")

    temp_url = response.data[0].url
    revised_prompt = response.data[0].revised_prompt or prompt

    # DALL·E returns a short-lived hosted URL; pull the bytes ourselves
    # before it expires so we can persist to S3 downstream.
    try:
        async with httpx.AsyncClient(timeout=20.0) as http:
            img_response = await http.get(temp_url)
            img_response.raise_for_status()
            image_bytes = img_response.content
    except Exception as exc:
        raise ProviderError("openai", f"image download failed: {exc}") from exc

    return {
        "image_bytes": image_bytes,
        "revised_prompt": revised_prompt,
    }
