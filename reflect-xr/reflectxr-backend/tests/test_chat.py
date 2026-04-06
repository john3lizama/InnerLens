"""
test_chat.py — Tests for POST /chat and POST /chat/generate-from-conversation.

GPT-4o and DALL-E calls are mocked so no real API costs are incurred.
Tests verify session creation, message persistence, crisis detection,
and the auto-generation trigger logic.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.concept import Concept, Style
from app.models.message import Message
from app.models.session import Session

# ── Shared helpers ────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
CHAT_URL = "/chat"
CHAT_GEN_URL = "/chat/generate-from-conversation"

USER = {"email": "chat_user@example.com", "password": "Pass1234!", "display_name": "Chat Tester"}


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    await client.post(REGISTER_URL, json=USER)
    resp = await client.post(LOGIN_URL, json={"email": USER["email"], "password": USER["password"]})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _seed_concept(db: AsyncSession) -> None:
    db.add(Concept(
        id=uuid.uuid4(),
        title="Emotional Waves",
        slug="emotional-waves",
        prompt_template="Create waves of [DROPDOWN] that rise and fade.",
        dropdown_label="Pick an Emotion",
        dropdown_options=["worry", "hope"],
        reflection_prompt="What helps this feeling soften?",
        category="core",
    ))
    db.add(Style(id=uuid.uuid4(), name="Watercolor", category="medium"))
    await db.commit()


def _fake_gpt_response(content: str = "I hear you. That sounds really hard."):
    """Minimal mock of an OpenAI chat completion response."""
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    return response


def _fake_emotion_response(emotions: list[dict] | None = None):
    """Mock for emotion extraction GPT call."""
    if emotions is None:
        emotions = [{"emotion": "worry", "intensity": 0.8}]
    choice = MagicMock()
    choice.message.content = str(emotions).replace("'", '"')
    response = MagicMock()
    response.choices = [choice]
    return response


# ── Tests ─────────────────────────────────────────────────────────────────

async def test_chat_creates_new_session(client: AsyncClient, db: AsyncSession):
    """Sending a message without a session_id should create a new session."""
    headers = await _auth_headers(client)

    with patch(
        "app.services.chat_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_gpt_response(),
    ), patch(
        "app.services.emotion_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_emotion_response(),
    ):
        resp = await client.post(
            CHAT_URL,
            json={"session_id": None, "message": "I feel really anxious today"},
            headers=headers,
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "session_id" in body
    assert body["session_id"] is not None
    assert "reply" in body
    assert body["is_crisis"] is False


async def test_chat_continues_existing_session(client: AsyncClient, db: AsyncSession):
    """Subsequent messages with the same session_id should use the same session."""
    headers = await _auth_headers(client)

    with patch(
        "app.services.chat_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_gpt_response(),
    ), patch(
        "app.services.emotion_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_emotion_response(),
    ):
        resp1 = await client.post(
            CHAT_URL,
            json={"session_id": None, "message": "Hello"},
            headers=headers,
        )
        session_id = resp1.json()["session_id"]

        resp2 = await client.post(
            CHAT_URL,
            json={"session_id": session_id, "message": "I feel worried"},
            headers=headers,
        )

    assert resp2.status_code == 200
    assert resp2.json()["session_id"] == session_id

    # Both messages should be saved to DB
    result = await db.execute(select(Message).where(Message.session_id == uuid.UUID(session_id)))
    messages = result.scalars().all()
    user_messages = [m for m in messages if m.role == "user"]
    assert len(user_messages) == 2


async def test_chat_detects_crisis(client: AsyncClient, db: AsyncSession):
    """Crisis keywords should trigger is_crisis=True and skip the LLM call."""
    headers = await _auth_headers(client)

    # No mock needed — crisis detection is pure keyword matching, no API call
    resp = await client.post(
        CHAT_URL,
        json={"session_id": None, "message": "I want to hurt myself"},
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_crisis"] is True
    assert body["should_generate_image"] is False
    # Crisis response should mention a helpline
    assert "988" in body["reply"] or "crisis" in body["reply"].lower()


async def test_chat_requires_auth(client: AsyncClient):
    resp = await client.post(CHAT_URL, json={"session_id": None, "message": "hello"})
    assert resp.status_code == 401


async def test_chat_returns_emotion_tags(client: AsyncClient, db: AsyncSession):
    """Response should include parsed emotion tags."""
    headers = await _auth_headers(client)

    with patch(
        "app.services.chat_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_gpt_response(),
    ), patch(
        "app.services.emotion_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_emotion_response([{"emotion": "anxiety", "intensity": 0.75}]),
    ):
        resp = await client.post(
            CHAT_URL,
            json={"session_id": None, "message": "Everything feels overwhelming"},
            headers=headers,
        )

    body = resp.json()
    assert isinstance(body["emotion_tags"], list)


async def test_chat_generate_from_conversation(client: AsyncClient, db: AsyncSession):
    """POST /chat/generate-from-conversation should return an image dict."""
    await _seed_concept(db)
    headers = await _auth_headers(client)

    # First build a session with a couple of messages
    with patch(
        "app.services.chat_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_gpt_response(),
    ), patch(
        "app.services.emotion_service.client.chat.completions.create",
        new_callable=AsyncMock,
        return_value=_fake_emotion_response(),
    ):
        resp = await client.post(
            CHAT_URL,
            json={"session_id": None, "message": "I feel very worried"},
            headers=headers,
        )
    session_id = resp.json()["session_id"]

    def _fake_dalle():
        image_data = MagicMock()
        image_data.url = "https://fake-openai.example.com/img.png"
        image_data.revised_prompt = "Waves of worry"
        r = MagicMock()
        r.data = [image_data]
        return r

    with (
        patch(
            "app.services.image_service.client.images.generate",
            new_callable=AsyncMock,
            return_value=_fake_dalle(),
        ),
        patch(
            "app.services.image_service.client.moderations.create",
            new_callable=AsyncMock,
            return_value=MagicMock(results=[MagicMock(flagged=False)]),
        ),
        patch("app.utils.storage.s3_client.put_object", return_value={}),
        patch("app.services.image_service.httpx.AsyncClient") as mock_http,
        patch(
            "app.services.emotion_service.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=_fake_emotion_response(),
        ),
    ):
        fake_resp = MagicMock()
        fake_resp.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        mock_http.return_value.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=fake_resp))
        )
        mock_http.return_value.__aexit__ = AsyncMock(return_value=False)

        gen_resp = await client.post(
            CHAT_GEN_URL,
            json={"session_id": session_id},
            headers=headers,
        )

    assert gen_resp.status_code == 200, gen_resp.text
    body = gen_resp.json()
    assert "image" in body
    assert "emotion_summary" in body
    assert "image_url" in body["image"]
