"""
alexa.py router — Alexa Custom Skill webhook.

Alexa calls POST /alexa/webhook for every interaction. This router:
1. Validates the applicationId matches AMAZON_SKILL_ID
2. Routes by request type (LaunchRequest, IntentRequest, SessionEndedRequest)
3. For FreeFormIntent and FallbackIntent — proxies the spoken text to chat_service
4. Triggers image generation directly when the chat service signals it
5. Returns Alexa-formatted JSON responses

AUTH: Uses a fixed demo user (seeded in seed.py) so Alexa doesn't need
OAuth or account linking. The skill ID check is the security gate.

ALEXA DEVELOPER CONSOLE SETUP:
- Endpoint type: HTTPS
- Default region URL: https://<your-deployed-api>/alexa/webhook
- SSL cert: "My development endpoint has a certificate from a trusted CA"
  (or "wildcard" if using *.ngrok.io for local testing)
"""

import uuid
import httpx
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import async_session
from app.config import settings
from app.models.user import User
from app.services.chat_service import handle_chat_message, generate_from_conversation

ALEXA_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _get_or_create_demo_user(db: AsyncSession) -> uuid.UUID:
    """Return the Alexa demo user, creating it if it doesn't exist yet."""
    result = await db.execute(select(User).where(User.id == ALEXA_DEMO_USER_ID))
    if result.scalar_one_or_none() is None:
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(
            id=ALEXA_DEMO_USER_ID,
            email="alexa-demo@innerlens.internal",
            display_name="Alexa",
            hashed_password=pwd_ctx.hash("alexa-demo-not-a-real-password"),
        ))
        await db.commit()
    return ALEXA_DEMO_USER_ID


router = APIRouter()

# ── Alexa response builder ────────────────────────────────────────────────

def _speak(
    speech: str,
    session_attrs: dict | None = None,
    should_end: bool = False,
    reprompt: str | None = None,
) -> dict:
    """Build a well-formed Alexa response envelope."""
    response: dict = {
        "version": "1.0",
        "sessionAttributes": session_attrs or {},
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": speech,
            },
            "shouldEndSession": should_end,
        },
    }
    if reprompt:
        response["response"]["reprompt"] = {
            "outputSpeech": {"type": "PlainText", "text": reprompt}
        }
    return response


def _extract_speech(body: dict) -> str:
    """
    Extract the user's raw spoken text from anywhere Alexa may put it.

    Alexa puts speech in different places depending on intent type:
    - FreeFormIntent: in the slot value
    - FallbackIntent: sometimes in slot, sometimes not at all
    - All intents: the raw transcript is in body["request"]["intent"]["slots"]
      or in the top-level body["request"] as "rawQuery" on some platforms

    We try every location and return the first non-empty value found.
    """
    req = body.get("request", {})
    intent = req.get("intent", {})
    slots = intent.get("slots", {})

    # Try every slot value (covers message, query, utterance, etc.)
    for slot in slots.values():
        val = slot.get("value", "").strip()
        if val:
            return val

    # Some Alexa platforms expose the raw transcript here
    raw = req.get("rawQuery", "").strip()
    if raw:
        return raw

    return ""


async def _send_progressive_response(api_endpoint: str, api_token: str, speech: str) -> None:
    """
    Send a progressive response to Alexa to keep the session alive
    while the GPT call is processing. Alexa kills sessions after 8 seconds
    of silence — this buys us extra time by speaking immediately.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as http:
            await http.post(
                f"{api_endpoint}/v1/directives",
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "header": {"requestId": uuid.uuid4().hex},
                    "directive": {
                        "type": "VoicePlayer.Speak",
                        "speech": f"<speak>{speech}</speak>",
                    },
                },
            )
    except Exception:
        pass  # Progressive response is best-effort, never block on it


# ── Shared chat handler ───────────────────────────────────────────────────

async def _handle_user_speech(user_text: str, session_id: uuid.UUID | None, body: dict) -> dict:
    """
    Send user speech to the chat service, trigger image generation if needed,
    and return the Alexa response dict.

    Used by both FreeFormIntent and FallbackIntent so any speech the user
    makes after launch is routed to MindMate — even if Alexa can't match
    it to a named intent slot.
    """
    # Send a progressive response immediately to keep the Alexa session alive
    # while GPT processes. Without this, Alexa kills the session after 8s.
    api_endpoint = body.get("context", {}).get("System", {}).get("apiEndpoint", "")
    api_token = body.get("context", {}).get("System", {}).get("apiAccessToken", "")
    if api_endpoint and api_token:
        await _send_progressive_response(api_endpoint, api_token, "Hmm, let me think about that.")

    async with async_session() as db:
        demo_user_id = await _get_or_create_demo_user(db)
        result = await handle_chat_message(
            db=db,
            user_id=demo_user_id,
            session_id=session_id,
            message=user_text,
        )

        new_session_id = str(result["session_id"])
        reply = result["reply"]
        should_generate = result.get("should_generate_image", False)

        # Actually generate the image when triggered, not just announce it
        if should_generate:
            try:
                await generate_from_conversation(
                    db=db,
                    user_id=demo_user_id,
                    session_id=result["session_id"],
                )
                reply += (
                    " I've created some artwork based on our conversation. "
                    "Open InnerLens on your phone to see it."
                )
            except Exception:
                # Don't let image generation failure break the conversation
                pass

    return _speak(
        speech=reply,
        session_attrs={"session_id": new_session_id},
        reprompt="Is there anything else you'd like to share?",
        should_end=False,
    )


# ── Main webhook ──────────────────────────────────────────────────────────

@router.post("/webhook")
async def alexa_webhook(request: Request):
    """
    POST /alexa/webhook — Entry point for all Alexa skill requests.
    """
    body = await request.json()

    # ── Security: validate this request is from our skill ────────────────
    application_id = (
        body.get("session", {})
            .get("application", {})
            .get("applicationId", "")
    )
    if settings.AMAZON_SKILL_ID and application_id != settings.AMAZON_SKILL_ID:
        raise HTTPException(status_code=403, detail="Invalid Alexa Skill ID")

    request_type = body.get("request", {}).get("type", "")

    # ── LaunchRequest: user says "Alexa, open Mind Mate" ─────────────────
    if request_type == "LaunchRequest":
        return _speak(
            speech=(
                "Welcome to InnerLens Mind Mate. "
                "I'm here to listen. How are you feeling today?"
            ),
            reprompt="What's on your mind? You can share anything.",
            should_end=False,
        )

    # ── IntentRequest ─────────────────────────────────────────────────────
    if request_type == "IntentRequest":
        intent_name = body["request"]["intent"]["name"]
        session_attrs = body.get("session", {}).get("attributes", {})
        session_id_str = session_attrs.get("session_id")
        session_id = uuid.UUID(session_id_str) if session_id_str else None

        # Built-in cancel / stop intents
        if intent_name in ("AMAZON.CancelIntent", "AMAZON.StopIntent"):
            return _speak(
                speech="Take care of yourself. Goodbye.",
                should_end=True,
            )

        # Built-in help intent
        if intent_name == "AMAZON.HelpIntent":
            return _speak(
                speech=(
                    "Just talk to me. You can say something like: "
                    "I've been feeling anxious about work. "
                    "I'll listen and respond. What would you like to share?"
                ),
                reprompt="What's on your mind?",
                should_end=False,
            )

        # FreeFormIntent, FallbackIntent, or any other intent —
        # all go to MindMate if there's captured speech.
        # This makes the skill resilient regardless of which intent fires.
        user_text = _extract_speech(body)

        if not user_text:
            return _speak(
                speech=(
                    "I didn't quite catch that. "
                    "Try saying something like: I feel stressed about school."
                ),
                reprompt="What's on your mind?",
                should_end=False,
            )

        try:
            return await _handle_user_speech(user_text, session_id, body)
        except Exception:
            return _speak(
                speech=(
                    "I'm having trouble connecting right now. "
                    "Please try again in a moment."
                ),
                reprompt="Would you like to try again?",
                should_end=False,
            )

    # ── SessionEndedRequest: user exits or times out ──────────────────────
    if request_type == "SessionEndedRequest":
        # Alexa does not expect a spoken response here
        return {"version": "1.0", "response": {}}

    # Unknown request type — return empty response
    return {"version": "1.0", "response": {}}
