"""
safety.py — Content safety checks for ReflectXR.

Two layers of protection:

1. check_crisis(text) — FAST, runs BEFORE any AI call.
   Scans user input for crisis keywords (suicide, self-harm, etc.)
   and returns an immediate empathetic response with hotline info.
   This is a simple keyword match — no API call, no cost, no latency.

2. check_moderation(text) — Calls OpenAI's Moderation API.
   Checks if text violates content policies (hate, violence, etc.)
   Used before sending prompts to DALL-E to prevent generating
   inappropriate images. The Moderation API is FREE (no token cost).

WHY TWO LAYERS?
- Crisis detection is too important to depend on an external API.
  If OpenAI is down, crisis keywords still get caught instantly.
- Moderation catches subtler policy violations that keywords miss.
  Together they form a defense-in-depth safety system.
"""

from openai import AsyncOpenAI
from app.config import settings

# ── OpenAI client (reused across calls) ─────────────────────────────────
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0)


# ══════════════════════════════════════════════════════════════════════════
# LAYER 1: Crisis Keyword Detection (instant, no API call)
# ══════════════════════════════════════════════════════════════════════════

CRISIS_KEYWORDS = [
    "hurt myself", "kill myself", "don't want to live",
    "end my life", "want to die", "wanna die",
    "suicide", "suicidal",
    "self harm", "self-harm", "cut myself",
    "end it all", "no reason to live",
    "giving up on life", "give up on life",
    "don't wanna live", "dont want to live", "dont wanna live",
    "better off dead", "wish i was dead", "wish i were dead",
    "not worth living", "can't go on", "cant go on",
    "jump off", "hang myself", "overdose",
    "killing myself", "hurting myself",
]

CRISIS_RESPONSE = (
    "I'm really sorry you're going through this. "
    "I'm not able to provide the help you need right now. "
    "Please call or text 988 if you're in the U.S., "
    "or contact local emergency services or someone nearby right away. "
    "You matter, and there are people who can help."
)


def check_crisis(text: str) -> str | None:
    """
    Scan text for crisis keywords. Returns crisis response if found, else None.

    This runs BEFORE any AI call — it's a fast, free safety net.
    If a keyword is detected, the chat service short-circuits and
    returns the crisis response immediately without calling GPT.
    """
    lowered = text.lower()
    for keyword in CRISIS_KEYWORDS:
        if keyword in lowered:
            return CRISIS_RESPONSE
    return None


# ══════════════════════════════════════════════════════════════════════════
# LAYER 2: OpenAI Moderation API (free, catches policy violations)
# ══════════════════════════════════════════════════════════════════════════

async def check_moderation(text: str) -> dict:
    """
    Check text against OpenAI's content moderation policy.

    Returns:
        {
            "flagged": bool,      # True if any category was violated
            "categories": {...},  # Which categories were flagged
            "message": str | None # User-friendly message if flagged
        }

    The Moderation API is FREE — no token cost. We use it to screen
    prompts before sending them to DALL-E, which refuses (and still
    charges for) policy-violating requests.

    If the API call fails for any reason, we return unflagged (fail-open)
    so the app doesn't break. DALL-E has its own content filter as a
    backup, so this is safe.
    """
    try:
        response = await client.moderations.create(input=text)
        result = response.results[0]

        if result.flagged:
            return {
                "flagged": True,
                "categories": result.categories.model_dump(),
                "message": (
                    "This content was flagged by our safety system. "
                    "Please try rephrasing with different words."
                ),
            }

        return {"flagged": False, "categories": None, "message": None}

    except Exception:
        # Fail open — if moderation API is down, let DALL-E's own
        # content filter handle it. Better than blocking all image gen.
        return {"flagged": False, "categories": None, "message": None}
