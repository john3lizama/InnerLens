"""
safety.py — Content safety checks for ReflectXR.

THREE layers of protection:

1. check_crisis(text) — FAST, runs BEFORE any AI call.
   Scans user input for crisis keywords (suicide, self-harm, etc.)
   and returns an immediate empathetic response with hotline info.
   This is a simple keyword match — no API call, no cost, no latency.

2. check_moderation(text) — Calls OpenAI's Moderation API.
   Checks if text violates content policies (hate, violence, etc.)
   Used before sending prompts to DALL-E to prevent generating
   inappropriate images. The Moderation API is FREE (no token cost).

3. check_image_safety(image_bytes) — Calls AWS Rekognition.
   Scans generated images AFTER DALL-E returns them, BEFORE saving
   to S3. Catches any inappropriate visual content that slipped
   through the prompt-level filters.
   Uses the same AWS credentials already in .env (no new key needed).

WHY THREE LAYERS?
- Crisis detection is too important to depend on an external API.
  If OpenAI is down, crisis keywords still get caught instantly.
- Moderation catches subtler policy violations that keywords miss.
- Rekognition is a final image-level backstop — even a clean prompt
  can occasionally produce unexpected output from DALL-E. This ensures
  nothing inappropriate ever gets saved to S3 or shown to users.
"""

import boto3
from openai import AsyncOpenAI
from app.config import settings

# ── OpenAI client (reused across calls) ─────────────────────────────────
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0)

# ── AWS Rekognition client ───────────────────────────────────────────────
# Uses the same AWS credentials already in .env — no new key needed.
rekognition_client = boto3.client(
    "rekognition",
    region_name="us-east-1",
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
)

# Rekognition moderation labels we block.
# Full list: https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
# We block anything explicit or suggestive — violence is allowed at low
# confidence since some emotional art may include abstract dark themes.
BLOCKED_LABELS = {
    "Explicit Nudity",
    "Nudity",
    "Graphic Male Nudity",
    "Graphic Female Nudity",
    "Sexual Activity",
    "Illustrated Explicit Nudity",
    "Adult Toys",
    "Suggestive",
    "Female Swimwear Or Underwear",
    "Male Swimwear Or Underwear",
    "Partial Nudity",
    "Barechested Male",
    "Revealing Clothes",
    "Graphic Violence Or Gore",
    "Physical Violence",
    "Weapon Violence",
    "Weapons",
    "Self Injury",
    "Hate Symbols",
    "Nazi Party",
    "White Supremacy",
    "Extremist",
}

# Minimum confidence threshold to block a label (0-100).
# 70 = block if Rekognition is 70%+ confident the label applies.
# Lower = more strict, higher = more lenient.
CONFIDENCE_THRESHOLD = 70.0


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


# ══════════════════════════════════════════════════════════════════════════
# LAYER 3: AWS Rekognition Image Safety (post-generation visual scan)
# ══════════════════════════════════════════════════════════════════════════

def check_image_safety(image_bytes: bytes) -> dict:
    """
    Scan generated image bytes for inappropriate visual content using
    AWS Rekognition's content moderation API.

    This runs AFTER DALL-E generates an image, BEFORE it gets saved
    to S3. Acts as a final visual backstop — even clean prompts can
    occasionally produce unexpected output.

    NOTE: This is a synchronous call (boto3 doesn't have async support).
    It's fast enough (~200-400ms) that it won't noticeably slow down
    the pipeline. If needed, wrap in asyncio.to_thread() for async context.

    Args:
        image_bytes: Raw PNG/JPEG bytes of the generated image

    Returns:
        {
            "safe": bool,           # True if image is safe to save
            "flagged_labels": [...], # Labels that triggered the block
            "message": str | None   # User-friendly message if flagged
        }

    If Rekognition is unavailable, we fail open (return safe=True)
    so DALL-E failures don't cascade into a broken user experience.
    The two upstream layers (crisis + moderation) still provide coverage.
    """
    try:
        response = rekognition_client.detect_moderation_labels(
            Image={"Bytes": image_bytes},
            MinConfidence=CONFIDENCE_THRESHOLD,
        )

        flagged = [
            label["Name"]
            for label in response.get("ModerationLabels", [])
            if label["Name"] in BLOCKED_LABELS
        ]

        if flagged:
            return {
                "safe": False,
                "flagged_labels": flagged,
                "message": (
                    "The generated image was flagged by our safety system "
                    "and cannot be saved. Please try a different prompt or style."
                ),
            }

        return {"safe": True, "flagged_labels": [], "message": None}

    except Exception as e:
        # Fail open — if Rekognition is down, let the image through.
        # Upstream filters (crisis keywords + OpenAI moderation) still apply.
        print(f"[safety] Rekognition check failed (fail-open): {e}")
        return {"safe": True, "flagged_labels": [], "message": None}