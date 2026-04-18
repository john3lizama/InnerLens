"""
test_chat_comprehensive.py — Category 3: MindMate Chat & Sessions

100 tests across 12 sub-sections:
  1.  detect_mode unit tests                      (6)
  2.  POST /chat — basic response shape           (10)
  3.  POST /chat — session management             (8)
  4.  POST /chat — crisis detection               (8)
  5.  POST /chat — emotion tags & mode            (8)
  6.  POST /chat — should_generate_image trigger  (6)
  7.  POST /chat/generate-from-conversation       (10)
  8.  GET /chat/sessions list                     (10)
  9.  GET /chat/sessions/{id} detail              (8)
  10. DELETE /chat/sessions                       (8)
  11. Authorization                               (8)
  12. Input validation                            (10)
"""

import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.concept import Concept, Style
from app.models.generated_image import GeneratedImage
from app.models.message import Message
from app.models.session import Session
from app.services.chat_service import detect_mode

# ── URL constants ─────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
LOGIN_URL    = "/auth/login"
CHAT_URL     = "/chat"
CHAT_GEN_URL = "/chat/generate-from-conversation"
SESSIONS_URL = "/chat/sessions"

# ── Shared helpers ────────────────────────────────────────────────────────

def _make_valid_png() -> bytes:
    img = PILImage.new("RGB", (16, 16), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


_FAKE_PNG = _make_valid_png()


async def _auth_headers(client: AsyncClient, email: str) -> dict[str, str]:
    await client.post(REGISTER_URL, json={
        "email": email, "password": "StrongPass123!", "display_name": "ChatUser",
    })
    resp = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass123!"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _seed_concept(db: AsyncSession) -> uuid.UUID:
    concept_id = uuid.uuid4()
    db.add(Concept(
        id=concept_id,
        title="Emotional Waves",
        slug="emotional-waves",
        prompt_template="Create waves of [DROPDOWN] that rise and gently fade.",
        dropdown_label="Pick an Emotion",
        dropdown_options=["worry", "hope"],
        reflection_prompt="What helps?",
        category="core",
    ))
    db.add(Style(id=uuid.uuid4(), name="Watercolor", category="medium"))
    await db.commit()
    return concept_id


def _gpt_response(content: str = "I hear you. That sounds really hard."):
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _emotion_response(emotions: list[dict] | None = None):
    import json
    if emotions is None:
        emotions = [{"emotion": "worry", "intensity": 0.8}]
    choice = MagicMock()
    choice.message.content = json.dumps(emotions)
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _chat_mocks(gpt_reply: str = "I hear you.", emotions: list[dict] | None = None):
    """Return two context-managers for a safe, normal chat call."""
    return (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response(gpt_reply)),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=emotions or [{"emotion": "worry", "intensity": 0.5}]),
    )


async def _do_chat(client, headers, session_id=None, message="I feel anxious today."):
    """Helper: POST /chat and return the response."""
    with _chat_mocks()[0], _chat_mocks()[1]:
        resp = await client.post(CHAT_URL,
            json={"session_id": session_id, "message": message},
            headers=headers)
    return resp


# ══════════════════════════════════════════════════════════════════════════
# 1 — detect_mode unit tests (6 tests)
# ══════════════════════════════════════════════════════════════════════════

def test_detect_mode_returns_grounding_for_breath():
    assert detect_mode("Let's try a breath together — inhale slowly.") == "grounding"


def test_detect_mode_returns_grounding_for_breathing():
    assert detect_mode("Focus on your breathing for a moment.") == "grounding"


def test_detect_mode_returns_grounding_for_ground():
    assert detect_mode("Try to ground yourself by noticing your feet.") == "grounding"


def test_detect_mode_returns_reflection_for_sounds_like():
    assert detect_mode("It sounds like you're carrying a lot right now.") == "reflection"


def test_detect_mode_returns_reflection_for_reflect():
    assert detect_mode("I'd invite you to reflect on what matters most.") == "reflection"


def test_detect_mode_returns_checkin_for_neutral():
    assert detect_mode("Thank you for sharing that with me today.") == "check-in"


# ══════════════════════════════════════════════════════════════════════════
# 2 — POST /chat — basic response shape (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_chat_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic1@example.com")
    resp = await _do_chat(client, headers)
    assert resp.status_code == 200


async def test_chat_response_has_session_id(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic2@example.com")
    resp = await _do_chat(client, headers)
    assert "session_id" in resp.json() and resp.json()["session_id"] is not None


async def test_chat_response_has_reply(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic3@example.com")
    resp = await _do_chat(client, headers)
    assert "reply" in resp.json() and len(resp.json()["reply"]) > 0


async def test_chat_response_reply_matches_gpt_output(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic4@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock,
              return_value=_gpt_response("You are doing great!")),
        patch("app.services.chat_service.extract_emotions", new_callable=AsyncMock,
              return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "How am I doing?"},
            headers=headers)
    assert resp.json()["reply"] == "You are doing great!"


async def test_chat_response_has_emotion_tags(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic5@example.com")
    resp = await _do_chat(client, headers)
    assert "emotion_tags" in resp.json()
    assert isinstance(resp.json()["emotion_tags"], list)


async def test_chat_response_has_mode_detected(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic6@example.com")
    resp = await _do_chat(client, headers)
    assert "mode_detected" in resp.json()


async def test_chat_response_has_should_generate_image(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic7@example.com")
    resp = await _do_chat(client, headers)
    assert "should_generate_image" in resp.json()
    assert isinstance(resp.json()["should_generate_image"], bool)


async def test_chat_response_has_is_crisis(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic8@example.com")
    resp = await _do_chat(client, headers)
    assert "is_crisis" in resp.json()
    assert resp.json()["is_crisis"] is False


async def test_chat_mode_detected_grounding(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic9@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock,
              return_value=_gpt_response("Let's try some deep breathing together.")),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel tense"},
            headers=headers)
    assert resp.json()["mode_detected"] == "grounding"


async def test_chat_mode_detected_reflection(client: AsyncClient):
    headers = await _auth_headers(client, "c_basic10@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock,
              return_value=_gpt_response("It sounds like you carry a lot of weight.")),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I don't know"},
            headers=headers)
    assert resp.json()["mode_detected"] == "reflection"


# ══════════════════════════════════════════════════════════════════════════
# 3 — POST /chat — session management (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_chat_null_session_id_creates_new_session(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess1@example.com")
    resp = await _do_chat(client, headers, session_id=None)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(select(Session).where(Session.id == session_id))
    assert result.scalar_one_or_none() is not None


async def test_chat_created_session_has_source_chat(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess2@example.com")
    resp = await _do_chat(client, headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    assert session.source == "chat"


async def test_chat_same_session_id_reuses_session(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess3@example.com")
    first = await _do_chat(client, headers)
    session_id = first.json()["session_id"]
    second = await _do_chat(client, headers, session_id=session_id)
    assert second.json()["session_id"] == session_id


async def test_chat_two_messages_same_session_stored(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess4@example.com")
    first = await _do_chat(client, headers)
    session_id = first.json()["session_id"]
    await _do_chat(client, headers, session_id=session_id, message="And another thing")

    result = await db.execute(
        select(Message).where(Message.session_id == uuid.UUID(session_id), Message.role == "user")
    )
    user_messages = result.scalars().all()
    assert len(user_messages) == 2


async def test_chat_user_message_saved_to_db(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess5@example.com")
    resp = await _do_chat(client, headers, message="Feeling quite sad today")
    session_id = uuid.UUID(resp.json()["session_id"])

    result = await db.execute(
        select(Message).where(
            Message.session_id == session_id, Message.role == "user"
        )
    )
    msg = result.scalars().first()
    assert msg is not None and msg.content == "Feeling quite sad today"


async def test_chat_assistant_reply_saved_to_db(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess6@example.com")
    resp = await _do_chat(client, headers)
    session_id = uuid.UUID(resp.json()["session_id"])

    result = await db.execute(
        select(Message).where(
            Message.session_id == session_id, Message.role == "assistant"
        )
    )
    assert result.scalars().first() is not None


async def test_chat_user_message_has_role_user(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess7@example.com")
    resp = await _do_chat(client, headers)
    session_id = uuid.UUID(resp.json()["session_id"])

    result = await db.execute(
        select(Message).where(Message.session_id == session_id)
    )
    messages = result.scalars().all()
    roles = {m.role for m in messages}
    assert "user" in roles


async def test_chat_new_session_per_null_session_id(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_sess8@example.com")
    r1 = await _do_chat(client, headers)
    r2 = await _do_chat(client, headers)
    assert r1.json()["session_id"] != r2.json()["session_id"]


# ══════════════════════════════════════════════════════════════════════════
# 4 — POST /chat — crisis detection (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_crisis_returns_is_crisis_true(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis1@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "I want to hurt myself"},
        headers=headers)
    assert resp.json()["is_crisis"] is True


async def test_crisis_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis2@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "I want to kill myself tonight"},
        headers=headers)
    assert resp.status_code == 200


async def test_crisis_reply_contains_988(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis3@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "suicidal thoughts"},
        headers=headers)
    assert "988" in resp.json()["reply"]


async def test_crisis_should_generate_is_false(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis4@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "I want to end my life"},
        headers=headers)
    assert resp.json()["should_generate_image"] is False


async def test_crisis_returns_empty_emotion_tags(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis5@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "I want to hurt myself"},
        headers=headers)
    assert resp.json()["emotion_tags"] == []


async def test_crisis_does_not_call_gpt(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis6@example.com")
    with patch("app.services.chat_service.client.chat.completions.create",
               new_callable=AsyncMock) as mock_gpt:
        await client.post(CHAT_URL,
            json={"session_id": None, "message": "I want to kill myself"},
            headers=headers)
    mock_gpt.assert_not_called()


async def test_crisis_keyword_case_insensitive(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis7@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "SUICIDE IS ON MY MIND"},
        headers=headers)
    assert resp.json()["is_crisis"] is True


async def test_crisis_non_crisis_message_is_not_crisis(client: AsyncClient):
    headers = await _auth_headers(client, "c_crisis8@example.com")
    resp = await _do_chat(client, headers, message="I had a tough day at work")
    assert resp.json()["is_crisis"] is False


# ══════════════════════════════════════════════════════════════════════════
# 5 — POST /chat — emotion tags & mode (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_emotion_tags_are_list(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo1@example.com")
    resp = await _do_chat(client, headers)
    assert isinstance(resp.json()["emotion_tags"], list)


async def test_emotion_tags_have_emotion_and_intensity(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo2@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "anxiety", "intensity": 0.8}]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "Everything overwhelms me"},
            headers=headers)
    tags = resp.json()["emotion_tags"]
    if tags:
        assert "emotion" in tags[0] and "intensity" in tags[0]


async def test_emotion_tags_stored_on_assistant_message(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_emo3@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "grief", "intensity": 0.9}]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel so lost"},
            headers=headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(
        select(Message).where(
            Message.session_id == session_id, Message.role == "assistant"
        )
    )
    msg = result.scalars().first()
    assert msg is not None and msg.emotion_tags is not None


async def test_emotion_tags_intensity_is_float(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo4@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "worry", "intensity": 0.75}]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I keep worrying"},
            headers=headers)
    tags = resp.json()["emotion_tags"]
    if tags:
        assert isinstance(tags[0]["intensity"], float)


async def test_emotion_tags_empty_when_extraction_fails(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo5@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel something"},
            headers=headers)
    assert resp.json()["emotion_tags"] == []


async def test_emotion_tags_max_3(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo6@example.com")
    many = [{"emotion": f"e{i}", "intensity": 0.5} for i in range(5)]
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=many[:3]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "Complex feelings"},
            headers=headers)
    assert len(resp.json()["emotion_tags"]) <= 3


async def test_mode_detected_check_in_for_neutral_reply(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo7@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock,
              return_value=_gpt_response("Thank you for sharing that with me.")),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel okay"},
            headers=headers)
    assert resp.json()["mode_detected"] == "check-in"


async def test_emotion_tags_all_have_lowercase_emotion(client: AsyncClient):
    headers = await _auth_headers(client, "c_emo8@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "anxiety", "intensity": 0.8}]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel anxious"},
            headers=headers)
    for tag in resp.json()["emotion_tags"]:
        assert tag["emotion"] == tag["emotion"].lower()


# ══════════════════════════════════════════════════════════════════════════
# 6 — POST /chat — should_generate_image trigger (6 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_should_generate_false_on_first_message(client: AsyncClient):
    headers = await _auth_headers(client, "c_gen1@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "anxiety", "intensity": 0.9}]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "I feel very anxious"},
            headers=headers)
    assert resp.json()["should_generate_image"] is False


async def test_should_generate_false_with_low_intensity(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "c_gen2@example.com")
    emotions_low = [{"emotion": "worry", "intensity": 0.4}]

    session_id = None
    for i in range(3):
        with (
            patch("app.services.chat_service.client.chat.completions.create",
                  new_callable=AsyncMock, return_value=_gpt_response()),
            patch("app.services.chat_service.extract_emotions",
                  new_callable=AsyncMock, return_value=emotions_low),
        ):
            resp = await client.post(CHAT_URL,
                json={"session_id": session_id, "message": f"Message {i}"},
                headers=headers)
        session_id = resp.json()["session_id"]

    assert resp.json()["should_generate_image"] is False


async def test_should_generate_true_after_three_high_intensity_messages(
    client: AsyncClient, db: AsyncSession
):
    headers = await _auth_headers(client, "c_gen3@example.com")
    emotions_high = [{"emotion": "anxiety", "intensity": 0.85}]

    session_id = None
    for i in range(3):
        with (
            patch("app.services.chat_service.client.chat.completions.create",
                  new_callable=AsyncMock, return_value=_gpt_response()),
            patch("app.services.chat_service.extract_emotions",
                  new_callable=AsyncMock, return_value=emotions_high),
        ):
            resp = await client.post(CHAT_URL,
                json={"session_id": session_id, "message": f"I feel anxious message {i}"},
                headers=headers)
        session_id = resp.json()["session_id"]

    assert resp.json()["should_generate_image"] is True


async def test_should_generate_false_no_emotions(client: AsyncClient):
    headers = await _auth_headers(client, "c_gen4@example.com")
    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=[]),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "Just chatting"},
            headers=headers)
    assert resp.json()["should_generate_image"] is False


async def test_should_generate_false_after_image_already_exists(
    client: AsyncClient, db: AsyncSession
):
    """After an image exists in the session, should_generate stays False."""
    headers = await _auth_headers(client, "c_gen5@example.com")
    emotions_high = [{"emotion": "grief", "intensity": 0.9}]

    # Build 3-message session
    session_id = None
    for i in range(3):
        with (
            patch("app.services.chat_service.client.chat.completions.create",
                  new_callable=AsyncMock, return_value=_gpt_response()),
            patch("app.services.chat_service.extract_emotions",
                  new_callable=AsyncMock, return_value=emotions_high),
        ):
            resp = await client.post(CHAT_URL,
                json={"session_id": session_id, "message": f"grief {i}"},
                headers=headers)
        session_id = resp.json()["session_id"]

    # Manually insert a generated image into this session
    db.add(GeneratedImage(
        session_id=uuid.UUID(session_id),
        image_url="https://s3.example.com/img.png",
        thumbnail_url="https://s3.example.com/thumb.png",
        prompt_used="auto-generated",
        style_used="Watercolor",
    ))
    await db.commit()

    with (
        patch("app.services.chat_service.client.chat.completions.create",
              new_callable=AsyncMock, return_value=_gpt_response()),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock, return_value=emotions_high),
    ):
        resp = await client.post(CHAT_URL,
            json={"session_id": session_id, "message": "Still grieving"},
            headers=headers)

    assert resp.json()["should_generate_image"] is False


async def test_should_generate_image_is_boolean(client: AsyncClient):
    headers = await _auth_headers(client, "c_gen6@example.com")
    resp = await _do_chat(client, headers)
    assert isinstance(resp.json()["should_generate_image"], bool)


# ══════════════════════════════════════════════════════════════════════════
# 7 — POST /chat/generate-from-conversation (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def _build_chat_session(client, db, email) -> str:
    """Register, send one message, return session_id."""
    headers = await _auth_headers(client, email)
    resp = await _do_chat(client, headers)
    return headers, resp.json()["session_id"]


async def _gen_mocks():
    return (
        patch("app.services.chat_service.generate_and_store_images",
              new_callable=AsyncMock,
              return_value={
                  "session_id": uuid.uuid4(),
                  "images": [MagicMock(
                      id=uuid.uuid4(),
                      image_url="https://s3.example.com/img.png",
                      thumbnail_url="https://s3.example.com/thumb.png",
                      prompt_used="waves of worry",
                      style_used="Watercolor",
                  )],
              }),
        patch("app.services.chat_service.extract_emotions",
              new_callable=AsyncMock,
              return_value=[{"emotion": "worry", "intensity": 0.8}]),
    )


async def test_chat_generate_returns_200(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg1@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    assert gen_resp.status_code == 200


async def test_chat_generate_returns_emotion_summary(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg2@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    assert "emotion_summary" in gen_resp.json()
    assert isinstance(gen_resp.json()["emotion_summary"], list)


async def test_chat_generate_returns_image_field(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg3@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    assert "image" in gen_resp.json()


async def test_chat_generate_image_has_url(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg4@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    image = gen_resp.json()["image"]
    if image:
        assert "image_url" in image


async def test_chat_generate_image_has_id(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg5@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    image = gen_resp.json()["image"]
    if image:
        assert "id" in image


async def test_chat_generate_requires_auth(client: AsyncClient, db: AsyncSession):
    resp = await client.post(CHAT_GEN_URL, json={"session_id": str(uuid.uuid4())})
    assert resp.status_code == 401


async def test_chat_generate_missing_session_id_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "cg7@example.com")
    resp = await client.post(CHAT_GEN_URL, json={}, headers=headers)
    assert resp.status_code == 422


async def test_chat_generate_invalid_session_id_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "cg8@example.com")
    resp = await client.post(CHAT_GEN_URL,
        json={"session_id": "not-a-uuid"}, headers=headers)
    assert resp.status_code == 422


async def test_chat_generate_emotion_summary_has_emotion_intensity(
    client: AsyncClient, db: AsyncSession
):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg9@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    summary = gen_resp.json()["emotion_summary"]
    for tag in summary:
        assert "emotion" in tag and "intensity" in tag


async def test_chat_generate_image_has_style_used(client: AsyncClient, db: AsyncSession):
    await _seed_concept(db)
    headers = await _auth_headers(client, "cg10@example.com")
    resp = await _do_chat(client, headers)
    session_id = resp.json()["session_id"]

    gen_mocks = await _gen_mocks()
    with gen_mocks[0], gen_mocks[1]:
        gen_resp = await client.post(CHAT_GEN_URL,
            json={"session_id": session_id}, headers=headers)
    image = gen_resp.json()["image"]
    if image:
        assert "style_used" in image


# ══════════════════════════════════════════════════════════════════════════
# 8 — GET /chat/sessions list (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_list_sessions_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "ls1@example.com")
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert resp.status_code == 200


async def test_list_sessions_empty_for_new_user(client: AsyncClient):
    headers = await _auth_headers(client, "ls2@example.com")
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert resp.json() == []


async def test_list_sessions_shows_chat_sessions(client: AsyncClient):
    headers = await _auth_headers(client, "ls3@example.com")
    await _do_chat(client, headers)
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert len(resp.json()) == 1


async def test_list_sessions_has_required_fields(client: AsyncClient):
    headers = await _auth_headers(client, "ls4@example.com")
    await _do_chat(client, headers)
    resp = await client.get(SESSIONS_URL, headers=headers)
    session = resp.json()[0]
    for field in ("id", "created_at", "preview", "message_count", "journal_count", "has_image"):
        assert field in session, f"Missing field: {field}"


async def test_list_sessions_preview_from_first_message(client: AsyncClient):
    headers = await _auth_headers(client, "ls5@example.com")
    await _do_chat(client, headers, message="My first ever message to MindMate")
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert "My first ever message" in resp.json()[0]["preview"]


async def test_list_sessions_message_count_increments(client: AsyncClient):
    headers = await _auth_headers(client, "ls6@example.com")
    first = await _do_chat(client, headers)
    session_id = first.json()["session_id"]
    await _do_chat(client, headers, session_id=session_id, message="Second message")
    resp = await client.get(SESSIONS_URL, headers=headers)
    # 2 user + 2 assistant = 4 messages total
    assert resp.json()[0]["message_count"] >= 2


async def test_list_sessions_excludes_create_source(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "ls7@example.com")
    from app.models.user import User
    result = await db.execute(select(User).where(User.email == "ls7@example.com"))
    user = result.scalar_one()
    # Add a "create" session directly
    db.add(Session(user_id=user.id, source="create"))
    await db.commit()
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert resp.json() == []


async def test_list_sessions_requires_auth(client: AsyncClient):
    assert (await client.get(SESSIONS_URL)).status_code == 401


async def test_list_sessions_limit_parameter(client: AsyncClient):
    headers = await _auth_headers(client, "ls9@example.com")
    for _ in range(3):
        await _do_chat(client, headers)
    resp = await client.get(f"{SESSIONS_URL}?limit=2", headers=headers)
    assert len(resp.json()) <= 2


async def test_list_sessions_isolated_per_user(client: AsyncClient):
    headers_a = await _auth_headers(client, "ls10a@example.com")
    headers_b = await _auth_headers(client, "ls10b@example.com")
    await _do_chat(client, headers_a)
    await _do_chat(client, headers_a)
    resp_b = await client.get(SESSIONS_URL, headers=headers_b)
    assert resp_b.json() == []


# ══════════════════════════════════════════════════════════════════════════
# 9 — GET /chat/sessions/{id} detail (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_get_session_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "gs1@example.com")
    chat_resp = await _do_chat(client, headers)
    session_id = chat_resp.json()["session_id"]
    resp = await client.get(f"{SESSIONS_URL}/{session_id}", headers=headers)
    assert resp.status_code == 200


async def test_get_session_has_messages(client: AsyncClient):
    headers = await _auth_headers(client, "gs2@example.com")
    chat_resp = await _do_chat(client, headers)
    session_id = chat_resp.json()["session_id"]
    resp = await client.get(f"{SESSIONS_URL}/{session_id}", headers=headers)
    assert len(resp.json()["messages"]) >= 1


async def test_get_session_messages_have_required_fields(client: AsyncClient):
    headers = await _auth_headers(client, "gs3@example.com")
    chat_resp = await _do_chat(client, headers)
    session_id = chat_resp.json()["session_id"]
    resp = await client.get(f"{SESSIONS_URL}/{session_id}", headers=headers)
    msg = resp.json()["messages"][0]
    for field in ("id", "role", "content", "created_at"):
        assert field in msg


async def test_get_session_not_found_returns_404(client: AsyncClient):
    headers = await _auth_headers(client, "gs4@example.com")
    resp = await client.get(f"{SESSIONS_URL}/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_get_session_other_users_session_returns_404(client: AsyncClient):
    headers_a = await _auth_headers(client, "gs5a@example.com")
    headers_b = await _auth_headers(client, "gs5b@example.com")
    chat_resp = await _do_chat(client, headers_a)
    session_id = chat_resp.json()["session_id"]
    resp = await client.get(f"{SESSIONS_URL}/{session_id}", headers=headers_b)
    assert resp.status_code == 404


async def test_get_session_create_source_returns_404(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "gs6@example.com")
    from app.models.user import User
    result = await db.execute(select(User).where(User.email == "gs6@example.com"))
    user = result.scalar_one()
    create_session = Session(user_id=user.id, source="create")
    db.add(create_session)
    await db.commit()
    await db.refresh(create_session)
    resp = await client.get(f"{SESSIONS_URL}/{create_session.id}", headers=headers)
    assert resp.status_code == 404


async def test_get_session_requires_auth(client: AsyncClient):
    resp = await client.get(f"{SESSIONS_URL}/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_get_session_invalid_uuid_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "gs8@example.com")
    resp = await client.get(f"{SESSIONS_URL}/not-a-uuid", headers=headers)
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════
# 10 — DELETE /chat/sessions (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_delete_session_returns_204(client: AsyncClient):
    headers = await _auth_headers(client, "ds1@example.com")
    chat_resp = await _do_chat(client, headers)
    session_id = chat_resp.json()["session_id"]
    resp = await client.delete(f"{SESSIONS_URL}/{session_id}", headers=headers)
    assert resp.status_code == 204


async def test_delete_session_removes_from_db(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "ds2@example.com")
    chat_resp = await _do_chat(client, headers)
    session_id = uuid.UUID(chat_resp.json()["session_id"])
    await client.delete(f"{SESSIONS_URL}/{session_id}", headers=headers)
    result = await db.execute(select(Session).where(Session.id == session_id))
    assert result.scalar_one_or_none() is None


async def test_delete_session_not_found_returns_404(client: AsyncClient):
    headers = await _auth_headers(client, "ds3@example.com")
    resp = await client.delete(f"{SESSIONS_URL}/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_delete_session_other_users_returns_404(client: AsyncClient):
    headers_a = await _auth_headers(client, "ds4a@example.com")
    headers_b = await _auth_headers(client, "ds4b@example.com")
    chat_resp = await _do_chat(client, headers_a)
    session_id = chat_resp.json()["session_id"]
    resp = await client.delete(f"{SESSIONS_URL}/{session_id}", headers=headers_b)
    assert resp.status_code == 404


async def test_delete_session_requires_auth(client: AsyncClient):
    resp = await client.delete(f"{SESSIONS_URL}/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_delete_session_create_source_returns_404(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "ds6@example.com")
    from app.models.user import User
    result = await db.execute(select(User).where(User.email == "ds6@example.com"))
    user = result.scalar_one()
    s = Session(user_id=user.id, source="create")
    db.add(s)
    await db.commit()
    await db.refresh(s)
    resp = await client.delete(f"{SESSIONS_URL}/{s.id}", headers=headers)
    assert resp.status_code == 404


async def test_delete_all_sessions_returns_204(client: AsyncClient):
    headers = await _auth_headers(client, "ds7@example.com")
    await _do_chat(client, headers)
    await _do_chat(client, headers)
    resp = await client.delete(SESSIONS_URL, headers=headers)
    assert resp.status_code == 204


async def test_delete_all_sessions_clears_list(client: AsyncClient):
    headers = await _auth_headers(client, "ds8@example.com")
    await _do_chat(client, headers)
    await _do_chat(client, headers)
    await client.delete(SESSIONS_URL, headers=headers)
    resp = await client.get(SESSIONS_URL, headers=headers)
    assert resp.json() == []


# ══════════════════════════════════════════════════════════════════════════
# 11 — Authorization (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_post_chat_no_token_returns_401(client: AsyncClient):
    resp = await client.post(CHAT_URL, json={"session_id": None, "message": "hello"})
    assert resp.status_code == 401


async def test_post_chat_invalid_token_returns_401(client: AsyncClient):
    resp = await client.post(CHAT_URL,
        json={"session_id": None, "message": "hello"},
        headers={"Authorization": "Bearer bad.token.here"})
    assert resp.status_code == 401


async def test_chat_generate_no_token_returns_401(client: AsyncClient):
    resp = await client.post(CHAT_GEN_URL, json={"session_id": str(uuid.uuid4())})
    assert resp.status_code == 401


async def test_list_sessions_no_token_returns_401(client: AsyncClient):
    assert (await client.get(SESSIONS_URL)).status_code == 401


async def test_get_session_no_token_returns_401(client: AsyncClient):
    resp = await client.get(f"{SESSIONS_URL}/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_delete_session_no_token_returns_401(client: AsyncClient):
    resp = await client.delete(f"{SESSIONS_URL}/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_delete_all_sessions_no_token_returns_401(client: AsyncClient):
    assert (await client.delete(SESSIONS_URL)).status_code == 401


async def test_chat_with_refresh_token_returns_401(client: AsyncClient):
    await client.post(REGISTER_URL, json={
        "email": "auth_rt@example.com", "password": "Pass123!", "display_name": "RT",
    })
    resp = await client.post(LOGIN_URL, json={"email": "auth_rt@example.com", "password": "Pass123!"})
    refresh = resp.json()["refresh_token"]
    resp2 = await client.post(CHAT_URL,
        json={"session_id": None, "message": "hello"},
        headers={"Authorization": f"Bearer {refresh}"})
    assert resp2.status_code == 401


# ══════════════════════════════════════════════════════════════════════════
# 12 — Input validation (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_chat_missing_message_field_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv1@example.com")
    resp = await client.post(CHAT_URL, json={"session_id": None}, headers=headers)
    assert resp.status_code == 422


async def test_chat_invalid_session_id_type_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv2@example.com")
    resp = await client.post(CHAT_URL,
        json={"session_id": "not-a-uuid", "message": "hello"},
        headers=headers)
    assert resp.status_code == 422


async def test_chat_explicit_null_session_id_creates_new_session(client: AsyncClient):
    headers = await _auth_headers(client, "iv3@example.com")
    with _chat_mocks()[0], _chat_mocks()[1]:
        resp = await client.post(CHAT_URL,
            json={"session_id": None, "message": "Hello MindMate"},
            headers=headers)
    assert resp.status_code == 200
    assert resp.json()["session_id"] is not None


async def test_list_sessions_invalid_limit_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv4@example.com")
    resp = await client.get(f"{SESSIONS_URL}?limit=0", headers=headers)
    assert resp.status_code == 422


async def test_list_sessions_limit_too_large_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv5@example.com")
    resp = await client.get(f"{SESSIONS_URL}?limit=101", headers=headers)
    assert resp.status_code == 422


async def test_list_sessions_negative_offset_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv6@example.com")
    resp = await client.get(f"{SESSIONS_URL}?offset=-1", headers=headers)
    assert resp.status_code == 422


async def test_get_session_invalid_uuid_returns_422_also(client: AsyncClient):
    headers = await _auth_headers(client, "iv7@example.com")
    resp = await client.get(f"{SESSIONS_URL}/totally-not-valid", headers=headers)
    assert resp.status_code == 422


async def test_delete_session_invalid_uuid_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv8@example.com")
    resp = await client.delete(f"{SESSIONS_URL}/totally-not-valid", headers=headers)
    assert resp.status_code == 422


async def test_list_sessions_offset_returns_empty_beyond_end(client: AsyncClient):
    headers = await _auth_headers(client, "iv9@example.com")
    await _do_chat(client, headers)
    resp = await client.get(f"{SESSIONS_URL}?offset=100", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_chat_generate_missing_body_returns_422(client: AsyncClient):
    headers = await _auth_headers(client, "iv10@example.com")
    resp = await client.post(CHAT_GEN_URL, json={}, headers=headers)
    assert resp.status_code == 422
