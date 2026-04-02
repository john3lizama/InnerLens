"""
emotion_service.py — Extracts emotions from text using GPT-4o-mini.

Used in TWO places:
1. After every MindMate chat exchange (on the conversation text)
2. When a user saves a journal entry (on the reflection text)

This satisfies requirement R5 (emotional tagging / NLP).

COST NOTE from MODULE-3-AI docs:
Use gpt-4o-mini for extraction — it's 15x cheaper than gpt-4o
and accurate enough for emotion classification.
"""

import json
from openai import AsyncOpenAI
from app.config import settings
from app.ai.system_prompts import EMOTION_EXTRACTION_PROMPT

# ── OpenAI client ────────────────────────────────────────────────────────
# AsyncOpenAI lets us make non-blocking API calls.
# The API key comes from .env via config.py.
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def extract_emotions(text: str) -> list[dict]:
    """
    Takes any text (chat message or journal entry) and returns emotion tags.

    Returns a list like: [{"emotion": "anxiety", "intensity": 0.8}]
    Maximum 3 emotions per extraction.

    If the API call fails or returns bad JSON, returns an empty list
    (we never crash the request over emotion extraction).
    """
    # Don't waste an API call on empty or very short text
    if not text or len(text.strip()) < 10:
        return []

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",       # Cheaper model — good enough for classification
            messages=[
                {"role": "system", "content": EMOTION_EXTRACTION_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.3,           # Low temperature = more consistent/structured output
        )

        # Parse the JSON response
        raw = response.choices[0].message.content
        emotions = json.loads(raw)

        # Validate the shape: must be a list of {emotion, intensity} dicts
        validated = []
        for item in emotions:
            if "emotion" in item and "intensity" in item:
                validated.append({
                    "emotion": str(item["emotion"]).lower(),
                    "intensity": max(0.0, min(1.0, float(item["intensity"]))),
                })
        return validated[:3]  # Max 3 emotions

    except (json.JSONDecodeError, KeyError, IndexError, Exception) as e:
        # If anything goes wrong, return empty — don't crash the request
        print(f"[emotion_service] Extraction failed: {e}")
        return []
