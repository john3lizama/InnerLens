"""
gemini_image.py — Gemini 2.5 Flash Image ("Nano Banana") adapter.

Fallback provider for the /generate flow. Called when DALL·E 3 fails
on the sync path, and again during the async retry cycles.

Guardrails parity with OpenAI:
  1. The moderation gate (app/ai/safety.check_moderation) runs UPSTREAM
     of the provider race in image_service, so Gemini only ever sees
     moderation-approved prompts. That's the same gate DALL·E sees.
  2. In addition, we pass Gemini's `safety_settings` at the API level
     so the model itself refuses anything severe on the output side.
     Threshold is BLOCK_MEDIUM_AND_ABOVE on all four harm categories —
     the strict setting short of "block anything flagged at all."

Model: `gemini-2.5-flash-image`. If Google renames or deprecates this,
only `GEMINI_MODEL` below needs to change.
"""

import base64

# Import defensively — the `google-genai` package is a new dep added in
# this change. If it isn't installed yet (e.g. someone pulled the commit
# but hasn't run `pip install -r requirements.txt`), we want the backend
# to still boot and serve /generate via the OpenAI path. The missing
# import surfaces as a ProviderError the first time we actually try to
# call Gemini — which flows through the standard fallback logic so the
# UX is identical to "Gemini is down."
try:
    from google import genai
    from google.genai import types

    _import_error: Exception | None = None
except ImportError as exc:  # pragma: no cover
    genai = None  # type: ignore[assignment]
    types = None  # type: ignore[assignment]
    _import_error = exc

from app.config import settings
from app.services.providers import ProviderError

GEMINI_MODEL = "gemini-2.5-flash-image"

# All four harm categories, all at the same threshold. Matches OpenAI's
# implicit stance (DALL·E rejects severe content by policy) without us
# needing to post-filter Gemini output.
#
# Built lazily inside `_safety_settings()` so we don't touch `types` at
# module-load time — otherwise a missing `google-genai` install would
# crash on import instead of surfacing as a clean ProviderError.
def _safety_settings():
    assert types is not None  # guarded by _get_client() raising first
    return [
        types.SafetySetting(
            category="HARM_CATEGORY_HARASSMENT",
            threshold="BLOCK_MEDIUM_AND_ABOVE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_HATE_SPEECH",
            threshold="BLOCK_MEDIUM_AND_ABOVE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold="BLOCK_MEDIUM_AND_ABOVE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold="BLOCK_MEDIUM_AND_ABOVE",
        ),
    ]

# Lazy-initialize: Settings load at import time, but we want a clearer
# error if GEMINI_API_KEY is blank than "invalid API key" from Google.
_client = None  # type: ignore[var-annotated]


def _get_client():
    """
    Lazy constructor for the Gemini client. Three things can go wrong
    here, each surfaces as a ProviderError so the race logic can decide
    whether to escalate:

      1. `google-genai` package isn't installed (see try/except at
         module top).
      2. GEMINI_API_KEY isn't configured.
      3. The SDK's `Client(...)` itself raises (e.g. malformed key).
    """
    global _client
    if _import_error is not None:
        raise ProviderError(
            "gemini",
            f"google-genai not installed — `pip install -r requirements.txt`: {_import_error}",
        )
    if _client is not None:
        return _client
    if not settings.GEMINI_API_KEY:
        raise ProviderError(
            "gemini",
            "GEMINI_API_KEY is not configured — add it to .env to enable fallback",
        )
    try:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:
        raise ProviderError("gemini", f"client init failed: {exc}") from exc
    return _client


def _extract_image_bytes(response) -> bytes | None:
    """
    Walk the response structure and return the first image part's bytes.

    Gemini returns candidates → content → parts[*], where an image part
    has `inline_data` with `mime_type` and `data`. Depending on SDK
    version, `data` may arrive as raw bytes or as a base64-encoded string;
    we handle both defensively.
    """
    if not response or not getattr(response, "candidates", None):
        return None

    for candidate in response.candidates:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", []) or []:
            inline = getattr(part, "inline_data", None)
            if inline is None:
                continue
            data = getattr(inline, "data", None)
            if data is None:
                continue
            if isinstance(data, bytes):
                return data
            if isinstance(data, str):
                # Older SDK releases delivered base64 strings. Newer
                # ones pre-decode. Try decode first; if that fails
                # (SDK already gave us bytes disguised as str), fall
                # back to UTF-8 encoding.
                try:
                    return base64.b64decode(data)
                except Exception:
                    return data.encode("utf-8")
    return None


async def generate_image(prompt: str) -> dict:
    """
    Generate a single image via Gemini 2.5 Flash Image.

    Same contract as `openai_image.generate_image`: returns
    `{ image_bytes, revised_prompt }` or raises `ProviderError`.

    Gemini doesn't return a "revised prompt" the way DALL·E does, so we
    echo the input prompt back — downstream callers persist this into
    `GeneratedImage.prompt_used`, which stays useful either way.
    """
    client = _get_client()

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                safety_settings=_safety_settings(),
            ),
        )
    except Exception as exc:
        raise ProviderError("gemini", f"generate failed: {exc}") from exc

    # The SDK surfaces prompt_feedback.block_reason when safety_settings
    # kill the request upstream of any candidates being produced.
    pf = getattr(response, "prompt_feedback", None)
    if pf is not None and getattr(pf, "block_reason", None):
        raise ProviderError(
            "gemini", f"blocked by safety_settings: {pf.block_reason}"
        )

    image_bytes = _extract_image_bytes(response)
    if image_bytes is None:
        raise ProviderError("gemini", "no image part in response")

    return {
        "image_bytes": image_bytes,
        "revised_prompt": prompt,  # Gemini doesn't revise; echo input
    }
