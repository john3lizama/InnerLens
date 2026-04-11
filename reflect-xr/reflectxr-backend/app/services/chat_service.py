"""
chat_service.py — MindMate conversation engine.

This is the most complex service. It handles:
1. Crisis detection (safety check BEFORE any AI call)
2. Building conversation context from message history
3. Calling GPT-4o for the empathetic response
4. Extracting emotions from the conversation
5. Deciding if auto-image-generation should trigger
6. Generating art from conversation emotions (when requested)

CONTEXT WINDOW: We keep the last 5 message pairs (10 messages)
for continuity. GPT-4o has 128k context, but keeping it small
saves money (~$0.005 per chat call).
"""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI
from app.config import settings
from app.models.session import Session
from app.models.message import Message
from app.models.generated_image import GeneratedImage
from app.models.concept import Concept
from app.ai.safety import check_crisis
from app.ai.system_prompts import MINDMATE_SYSTEM_PROMPT
from app.ai.emotion_map import EMOTION_TO_CONCEPT, DEFAULT_CONCEPT
from app.services.emotion_service import extract_emotions
from app.services.prompt_builder import build_prompt_from_emotions
from app.services.image_service import generate_and_store_images

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0)


async def handle_chat_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID | None,
    message: str,
    quick: bool = False,
) -> dict:
    """
    Process a user's chat message and return MindMate's response.

    Returns a dict matching ChatResponse schema.
    """

    # ── Step 1: Crisis check (runs BEFORE any AI call) ───────────────────
    crisis_response = check_crisis(message)
    if crisis_response:
        return {
            "session_id": session_id or uuid.uuid4(),
            "reply": crisis_response,
            "emotion_tags": [],
            "mode_detected": "check-in",
            "should_generate_image": False,
            "is_crisis": True,
        }

    # ── Step 2: Get or create a chat session ─────────────────────────────
    if session_id is None:
        session = Session(user_id=user_id, source="chat")
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id = session.id

    # ── Step 3: Save the user's message to the DB ────────────────────────
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    await db.commit()

    # ── Step 4: Build context from message history ───────────────────────
    # Load the last 10 messages (5 pairs of user + assistant)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    recent_messages = list(reversed(result.scalars().all()))

    # Build the context array for OpenAI
    context = [{"role": "system", "content": MINDMATE_SYSTEM_PROMPT}]
    for msg in recent_messages:
        context.append({"role": msg.role, "content": msg.content})

    # ── Step 5: Call GPT-4o for the empathetic response ──────────────────
    completion = await client.chat.completions.create(
        model="gpt-4o-mini",   # Faster response time — critical for Alexa's 8s timeout
        messages=context,
        temperature=0.7,       # Slightly creative but still grounded
        max_tokens=150,        # Shorter = faster = stays within Alexa timeout
    )
    reply = completion.choices[0].message.content

    # ── Step 6: Save the assistant's response ────────────────────────────
    # Build conversation text for emotion extraction
    conversation_text = "\n".join([
        f"{msg.role}: {msg.content}" for msg in recent_messages
    ])
    conversation_text += f"\nassistant: {reply}"

    if quick:
        # In quick mode (Alexa), skip synchronous emotion extraction.
        # Save the message immediately with empty tags — emotion extraction
        # will be run in the background by the caller after responding to Alexa.
        emotion_tags = []
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=reply,
            emotion_tags=[],
        )
        db.add(assistant_msg)
        await db.commit()

        # For image trigger in quick mode, use message count only —
        # emotions are not available yet so we signal after 3 messages
        # and let the caller decide whether to generate.
        user_msg_count = sum(1 for m in recent_messages if m.role == "user")
        existing_img = await db.execute(
            select(GeneratedImage)
            .where(GeneratedImage.session_id == session_id)
            .limit(1)
        )
        has_existing_image = existing_img.scalar_one_or_none() is not None
        should_generate = user_msg_count >= 3 and not has_existing_image
    else:
        # Normal mode (mobile) — extract emotions synchronously
        emotion_tags = await extract_emotions(conversation_text)
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=reply,
            emotion_tags=emotion_tags,
        )
        db.add(assistant_msg)
        await db.commit()

        user_msg_count = sum(1 for m in recent_messages if m.role == "user")
        dominant_intensity = max(
            (e["intensity"] for e in emotion_tags), default=0
        )
        existing_img = await db.execute(
            select(GeneratedImage)
            .where(GeneratedImage.session_id == session_id)
            .limit(1)
        )
        has_existing_image = existing_img.scalar_one_or_none() is not None
        should_generate = (
            user_msg_count >= 3
            and dominant_intensity >= 0.7
            and not has_existing_image
        )

    # ── Step 7: Determine mode ───────────────────────────────────────────
    mode = detect_mode(reply)

    return {
        "session_id": session_id,
        "reply": reply,
        "emotion_tags": emotion_tags,
        "mode_detected": mode,
        "should_generate_image": should_generate,
        "is_crisis": False,
        "conversation_text": conversation_text if quick else None,
    }


async def generate_from_conversation(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> dict:
    """
    Auto-generate art from a chat session's emotional content.

    Reads the conversation -> extracts emotions -> builds a prompt ->
    generates 1 image -> returns it.
    """
    # Load all messages in this session
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    # Build conversation text and extract emotions
    conversation_text = "\n".join(
        f"{msg.role}: {msg.content}" for msg in messages
    )
    emotions = await extract_emotions(conversation_text)

    # Use prompt_builder to convert emotions into an image prompt
    prompt, style = await build_prompt_from_emotions(emotions)

    # Resolve the concept_id from the dominant emotion via the emotion map
    dominant_emotion = (
        max(emotions, key=lambda e: e["intensity"])["emotion"]
        if emotions else None
    )
    concept_slug = (
        EMOTION_TO_CONCEPT.get(dominant_emotion, DEFAULT_CONCEPT)["concept"]
        if dominant_emotion else DEFAULT_CONCEPT["concept"]
    )
    concept_row = await db.execute(
        select(Concept).where(Concept.slug == concept_slug)
    )
    concept = concept_row.scalar_one_or_none()
    # Fall back to any concept if the slug isn't seeded yet
    if concept is None:
        fallback = await db.execute(select(Concept).limit(1))
        concept = fallback.scalar_one_or_none()
    concept_id = concept.id if concept else uuid.uuid4()

    gen_result = await generate_and_store_images(
        db=db,
        user_id=user_id,
        prompt=prompt,
        style=style,
        concept_id=concept_id,
        count=1,
    )

    return {
        "image": gen_result["images"][0] if gen_result["images"] else None,
        "emotion_summary": emotions,
    }


def detect_mode(reply: str) -> str:
    """
    Simple keyword-based mode detection.
    Checks the AI's reply to determine which conversational mode it's in.

    In a more sophisticated version, you could ask the LLM to classify this.
    """
    reply_lower = reply.lower()
    if any(word in reply_lower for word in ["breath", "breathing", "inhale", "exhale", "ground"]):
        return "grounding"
    elif any(word in reply_lower for word in ["reflect", "notice", "sounds like", "what would"]):
        return "reflection"
    else:
        return "check-in"
