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
import asyncio
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import async_session
from app.config import settings
from app.models.user import User
from app.models.session import Session as ChatSession
from app.models.message import Message as ChatMessage
from app.services.chat_service import handle_chat_message, generate_from_conversation

# Keywords that indicate the user is asking MindMate to recall a past conversation
_MEMORY_KEYWORDS = [
    "remember", "previous conversation", "last conversation",
    "last time", "we talked", "we spoke", "from before",
    "what we discussed", "earlier", "before",
]

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


# ── Shared chat handler ───────────────────────────────────────────────────

async def _handle_user_speech(user_text: str, session_id: uuid.UUID | None, body: dict) -> dict:
    """
    Send user speech to the chat service, trigger image generation if needed,
    and return the Alexa response dict.

    Used by both FreeFormIntent and FallbackIntent so any speech the user
    makes after launch is routed to MindMate — even if Alexa cannot match
    it to a named intent slot.
    """
    session_attrs = body.get("session", {}).get("attributes", {})
    previous_session_id_str = session_attrs.get("previous_session_id")

    # If the user is asking about a previous conversation, load that session's
    # messages and inject them as extra context so GPT can actually recall them.
    extra_context: str | None = None
    is_memory_question = any(kw in user_text.lower() for kw in _MEMORY_KEYWORDS)
    if is_memory_question and previous_session_id_str:
        try:
            prev_sid = uuid.UUID(previous_session_id_str)
            async with async_session() as ctx_db:
                prev_result = await ctx_db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == prev_sid)
                    .order_by(ChatMessage.created_at.asc())
                    .limit(20)
                )
                prev_msgs = prev_result.scalars().all()
                if prev_msgs:
                    summary = "\n".join(
                        f"{m.role}: {m.content}" for m in prev_msgs
                    )
                    extra_context = (
                        "The user is asking about a previous conversation. "
                        "Here is the transcript from that session:\n"
                        f"{summary}\n"
                        "Use this to answer their memory question naturally."
                    )
        except Exception:
            pass  # If loading fails, GPT will handle it gracefully via system prompt

    async with async_session() as db:
        demo_user_id = await _get_or_create_demo_user(db)
        # quick=True skips synchronous emotion extraction — saves ~2s per turn,
        # keeping every response well within Alexa's 8-second timeout.
        result = await handle_chat_message(
            db=db,
            user_id=demo_user_id,
            session_id=session_id,
            message=user_text,
            quick=True,
            extra_context=extra_context,
        )

    new_session_id = str(result["session_id"])
    reply = result["reply"]
    should_generate = result.get("should_generate_image", False)
    conversation_text = result.get("conversation_text", "")

    # Background task: extract emotions and optionally generate image.
    # Runs after Alexa response is already sent — no timeout risk.
    async def _background_work():
        try:
            async with async_session() as bg_db:
                from app.services.emotion_service import extract_emotions
                from app.models.message import Message as MsgModel
                from sqlalchemy import select as sa_select

                # Update the assistant message with real emotion tags
                emotions = await extract_emotions(conversation_text or "")
                if emotions:
                    msg_result = await bg_db.execute(
                        sa_select(MsgModel)
                        .where(MsgModel.session_id == result["session_id"])
                        .where(MsgModel.role == "assistant")
                        .order_by(MsgModel.created_at.desc())
                        .limit(1)
                    )
                    last_msg = msg_result.scalar_one_or_none()
                    if last_msg:
                        last_msg.emotion_tags = emotions
                        await bg_db.commit()

                # Generate image if triggered
                if should_generate:
                    await generate_from_conversation(
                        db=bg_db,
                        user_id=demo_user_id,
                        session_id=result["session_id"],
                    )
        except Exception:
            pass

    asyncio.create_task(_background_work())

    if should_generate:
        reply += (
            " I'm creating some artwork based on our conversation. "
            "Open InnerLens on your phone in a moment to see it."
        )

    # Carry previous_session_id forward so memory questions work on any turn,
    # not just the first one after launch.
    attrs: dict = {"session_id": new_session_id}
    if previous_session_id_str:
        attrs["previous_session_id"] = previous_session_id_str

    return _speak(
        speech=reply,
        session_attrs=attrs,
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
        # Load the most recent session for the demo user so we can offer
        # memory continuity. Each new invocation still creates a fresh session
        # (for independent image generation), but we store the previous session
        # ID so the user can ask "do you remember our last conversation".
        launch_attrs: dict = {}
        greeting = (
            "Welcome to InnerLens Mind Mate. "
            "I'm here to listen. How are you feeling today?"
        )
        try:
            async with async_session() as db:
                demo_user_id = await _get_or_create_demo_user(db)
                last_result = await db.execute(
                    select(ChatSession)
                    .where(ChatSession.user_id == demo_user_id)
                    .order_by(ChatSession.created_at.desc())
                    .limit(1)
                )
                last_session = last_result.scalar_one_or_none()
                if last_session:
                    # Only use as memory if it has actual messages
                    msg_check = await db.execute(
                        select(ChatMessage)
                        .where(ChatMessage.session_id == last_session.id)
                        .limit(1)
                    )
                    if msg_check.scalar_one_or_none() is not None:
                        launch_attrs["previous_session_id"] = str(last_session.id)
                        greeting = (
                            "Welcome back to InnerLens Mind Mate. "
                            "I'm here whenever you need me. "
                            "How are you feeling today?"
                        )
        except Exception:
            pass  # If DB lookup fails, fall back to standard greeting

        return _speak(
            speech=greeting,
            session_attrs=launch_attrs,
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
                    "I'm here and I'm listening. "
                    "You can say something like: I feel sad, "
                    "or just describe what's on your mind."
                ),
                reprompt="Take your time. What's been going on for you?",
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
