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
from app.ai.safety import check_crisis
from app.ai.system_prompts import MINDMATE_SYSTEM_PROMPT
from app.services.emotion_service import extract_emotions
from app.services.prompt_builder import build_prompt_from_emotions
from app.services.image_service import generate_and_store_images

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def handle_chat_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID | None,
    message: str,
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
        model="gpt-4o",       # Use gpt-4o-mini during development to save $$$
        messages=context,
        temperature=0.7,       # Slightly creative but still grounded
        max_tokens=300,        # 2-4 sentences = ~100-200 tokens
    )
    reply = completion.choices[0].message.content

    # ── Step 6: Save the assistant's response ────────────────────────────
    # Build conversation text for emotion extraction
    conversation_text = "\n".join([
        f"{msg.role}: {msg.content}" for msg in recent_messages
    ])
    conversation_text += f"\nassistant: {reply}"

    # Extract emotions from the full conversation
    emotion_tags = await extract_emotions(conversation_text)

    assistant_msg = Message(
        session_id=session_id,
        role="assistant",
        content=reply,
        emotion_tags=emotion_tags,
    )
    db.add(assistant_msg)
    await db.commit()

    # ── Step 7: Determine mode and auto-generation trigger ───────────────
    # Simple mode detection based on content keywords
    mode = detect_mode(reply)

    # Auto-generation triggers when:
    # 1. Session has 3+ user messages (enough conversation)
    # 2. A dominant emotion has intensity >= 0.7
    # 3. This session hasn't already generated an image
    user_msg_count = sum(1 for m in recent_messages if m.role == "user")
    dominant_intensity = max(
        (e["intensity"] for e in emotion_tags), default=0
    )
    should_generate = (
        user_msg_count >= 3
        and dominant_intensity >= 0.7
        # TODO: check if session already has a generated image
    )

    return {
        "session_id": session_id,
        "reply": reply,
        "emotion_tags": emotion_tags,
        "mode_detected": mode,
        "should_generate_image": should_generate,
        "is_crisis": False,
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

    # Generate 1 image (not 4 — this is auto-generation, not the full flow)
    # We need a concept_id — use a default one
    # TODO: map emotions to actual concept IDs from the database
    gen_result = await generate_and_store_images(
        db=db,
        user_id=user_id,
        prompt=prompt,
        style=style,
        concept_id=uuid.uuid4(),  # Placeholder — wire to real concept
        count=1,
    )

    return {
        "image": gen_result["images"][0] if gen_result["images"] else {},
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
