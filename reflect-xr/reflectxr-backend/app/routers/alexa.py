"""
alexa.py router — Alexa Custom Skill webhook.

Alexa calls POST /alexa/webhook for every interaction. This router:
1. Validates the applicationId matches AMAZON_SKILL_ID
2. Routes by request type (LaunchRequest, IntentRequest, SessionEndedRequest)
3. For FreeFormIntent — proxies the spoken text to chat_service
4. Returns Alexa-formatted JSON responses

AUTH: Uses a fixed demo user (seeded in seed.py) so Alexa doesn't need
OAuth or account linking. The skill ID check is the security gate.

ALEXA DEVELOPER CONSOLE SETUP:
- Endpoint type: HTTPS
- Default region URL: https://<your-deployed-api>/alexa/webhook
- SSL cert: "My development endpoint has a certificate from a trusted CA"
  (or "wildcard" if using *.ngrok.io for local testing)
"""

import uuid
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import async_session
from app.config import settings
from app.models.user import User
from app.services.chat_service import handle_chat_message

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

        # FreeFormIntent — the main conversational intent
        if intent_name == "FreeFormIntent":
            slots = body["request"]["intent"].get("slots", {})
            user_text = (
                slots.get("message", {}).get("value")
                or slots.get("query", {}).get("value")
                or ""
            ).strip()

            if not user_text:
                return _speak(
                    speech="I didn't catch that. Could you say that again?",
                    reprompt="What's on your mind?",
                    should_end=False,
                )

            try:
                async with async_session() as db:
                    demo_user_id = await _get_or_create_demo_user(db)
                    result = await handle_chat_message(
                        db=db,
                        user_id=demo_user_id,
                        session_id=session_id,
                        message=user_text,
                    )
            except Exception as exc:
                # Surface a friendly Alexa error rather than a bare 500
                return _speak(
                    speech=(
                        "I'm having trouble connecting right now. "
                        "Please try again in a moment."
                    ),
                    reprompt="Would you like to try again?",
                    should_end=False,
                )

            new_session_id = str(result["session_id"])
            reply = result["reply"]
            should_generate = result.get("should_generate_image", False)

            # If art was triggered, append a spoken cue
            if should_generate:
                reply += (
                    " I've created some artwork based on our conversation. "
                    "Open InnerLens on your phone to see it."
                )

            return _speak(
                speech=reply,
                session_attrs={"session_id": new_session_id},
                reprompt="Is there anything else you'd like to share?",
                should_end=False,
            )

        # Fallback for unrecognised intents
        return _speak(
            speech="I'm not sure how to help with that. Try telling me how you're feeling.",
            reprompt="What's on your mind?",
            should_end=False,
        )

    # ── SessionEndedRequest: user exits or times out ──────────────────────
    if request_type == "SessionEndedRequest":
        # Alexa does not expect a spoken response here
        return {"version": "1.0", "response": {}}

    # Unknown request type — return empty response
    return {"version": "1.0", "response": {}}
