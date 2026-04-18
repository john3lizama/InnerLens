"""
test_generate_comprehensive.py — Category 2: Image Generation Pipeline

100 tests across 11 sub-sections:
  1.  check_crisis unit tests                (8)
  2.  check_moderation unit tests            (8)
  3.  Prompt builder unit tests              (8)
  4.  Emotion extraction service             (8)
  5.  Image service utilities                (8)
  6.  POST /generate — 200 happy path       (15)
  7.  POST /generate — 202 fallback path    (10)
  8.  GET /generate/status/{job_id}         (10)
  9.  POST /generate/select                 (10)
  10. Input validation                        (8)
  11. Authorization checks                    (7)
"""

import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.safety import CRISIS_KEYWORDS, CRISIS_RESPONSE, check_crisis
from app.models.concept import Concept, Style
from app.models.generated_image import GeneratedImage
from app.models.image_job import ImageJob
from app.models.session import Session
from app.services.emotion_service import extract_emotions
from app.services.image_service import _make_thumbnail
from app.services.prompt_builder import build_prompt_from_emotions
from app.services.providers import AllProvidersFailed, ProviderError

# ── URL constants ─────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
GENERATE_URL = "/generate"
SELECT_URL = "/generate/select"

# ── Shared PNG fixture ────────────────────────────────────────────────────

def _make_valid_png(w: int = 64, h: int = 64) -> bytes:
    img = PILImage.new("RGB", (w, h), color=(128, 64, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

_FAKE_PNG = _make_valid_png()
_FAKE_IMAGE_URL = "https://s3.example.com/generated/img.png"
_FAKE_THUMB_URL = "https://s3.example.com/thumbnails/img.png"

# ── Shared helpers ────────────────────────────────────────────────────────

async def _auth_headers(client: AsyncClient, email: str = "gen@example.com") -> dict:
    await client.post(REGISTER_URL, json={
        "email": email, "password": "StrongPass123!", "display_name": "GenUser",
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
        reflection_prompt="What helps this feeling soften?",
        category="core",
    ))
    db.add(Style(id=uuid.uuid4(), name="Watercolor", category="medium"))
    await db.commit()
    return concept_id


async def _fake_upload(image_bytes: bytes, s3_key: str, **kwargs) -> str:
    return _FAKE_THUMB_URL if "thumbnails" in s3_key else _FAKE_IMAGE_URL


def _mocks_happy():
    """Context managers for a fully successful generate call."""
    return (
        patch("app.services.image_service.check_moderation", new_callable=AsyncMock,
              return_value={"flagged": False, "categories": None, "message": None}),
        patch("app.services.image_service.openai_image.generate_image", new_callable=AsyncMock,
              return_value={"image_bytes": _FAKE_PNG, "revised_prompt": "A wave of worry"}),
        patch("app.services.image_service.upload_image", side_effect=_fake_upload),
    )


def _mocks_all_fail():
    """Context managers that make all providers fail and skip the retry worker."""
    errors = [ProviderError("openai", "timeout"), ProviderError("gemini", "timeout")]
    return (
        patch("app.services.image_service.check_moderation", new_callable=AsyncMock,
              return_value={"flagged": False, "categories": None, "message": None}),
        patch("app.services.image_service._generate_one_image", new_callable=AsyncMock,
              side_effect=AllProvidersFailed(errors)),
        patch("app.routers.generate.schedule_retry"),
    )


# ══════════════════════════════════════════════════════════════════════════
# 1 — check_crisis unit tests (8 tests)
# ══════════════════════════════════════════════════════════════════════════

def test_check_crisis_detects_hurt_myself():
    assert check_crisis("I want to hurt myself") is not None


def test_check_crisis_detects_suicide_keyword():
    assert check_crisis("I am feeling suicidal tonight") is not None


def test_check_crisis_detects_kill_myself():
    assert check_crisis("I want to kill myself") is not None


def test_check_crisis_is_case_insensitive():
    assert check_crisis("I WANT TO HURT MYSELF") is not None
    assert check_crisis("Suicide is on my mind") is not None


def test_check_crisis_returns_none_for_safe_text():
    assert check_crisis("I had a hard day at work") is None


def test_check_crisis_response_contains_988():
    result = check_crisis("I want to end my life")
    assert result is not None
    assert "988" in result


def test_check_crisis_detects_keyword_within_sentence():
    assert check_crisis("Sometimes late at night I think about suicide a lot") is not None


def test_check_crisis_returns_none_for_empty_string():
    assert check_crisis("") is None


# ══════════════════════════════════════════════════════════════════════════
# 2 — check_moderation unit tests (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_check_moderation_unflagged_returns_false():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=False)])):
        from app.ai.safety import check_moderation
        result = await check_moderation("gentle waves of calm")
    assert result["flagged"] is False


async def test_check_moderation_flagged_prompt_returns_true():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=True,
               categories=MagicMock(model_dump=lambda: {"hate": True}))])):
        from app.ai.safety import check_moderation
        result = await check_moderation("flagged content here")
    assert result["flagged"] is True


async def test_check_moderation_returns_message_when_flagged():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=True,
               categories=MagicMock(model_dump=lambda: {}))])):
        from app.ai.safety import check_moderation
        result = await check_moderation("bad content")
    assert result["message"] is not None and len(result["message"]) > 0


async def test_check_moderation_returns_none_message_when_clean():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=False)])):
        from app.ai.safety import check_moderation
        result = await check_moderation("totally fine text")
    assert result["message"] is None


async def test_check_moderation_returns_none_categories_when_clean():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=False)])):
        from app.ai.safety import check_moderation
        result = await check_moderation("safe text")
    assert result["categories"] is None


async def test_check_moderation_returns_categories_when_flagged():
    cats = {"hate": True, "violence": False}
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=True,
               categories=MagicMock(model_dump=lambda: cats))])):
        from app.ai.safety import check_moderation
        result = await check_moderation("flagged")
    assert result["categories"] is not None


async def test_check_moderation_fails_open_on_api_exception():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               side_effect=Exception("API down")):
        from app.ai.safety import check_moderation
        result = await check_moderation("any text")
    assert result["flagged"] is False


async def test_check_moderation_empty_string_does_not_crash():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=MagicMock(results=[MagicMock(flagged=False)])):
        from app.ai.safety import check_moderation
        result = await check_moderation("")
    assert "flagged" in result


# ══════════════════════════════════════════════════════════════════════════
# 3 — Prompt builder unit tests (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_build_prompt_empty_emotions_returns_non_empty_template():
    prompt, style = await build_prompt_from_emotions([])
    assert isinstance(prompt, str) and len(prompt) > 0


async def test_build_prompt_empty_emotions_returns_watercolor_style():
    _, style = await build_prompt_from_emotions([])
    assert style == "Watercolor"


async def test_build_prompt_known_emotion_fills_dropdown():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "worry", "intensity": 0.7}])
    assert "worry" in prompt


async def test_build_prompt_no_placeholder_left_in_output():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "anxiety", "intensity": 0.6}])
    assert "[DROPDOWN]" not in prompt


async def test_build_prompt_high_intensity_returns_expressive_style():
    _, style = await build_prompt_from_emotions([{"emotion": "anxiety", "intensity": 0.9}])
    assert style == "Abstract / Expressionist"


async def test_build_prompt_medium_intensity_returns_watercolor_style():
    _, style = await build_prompt_from_emotions([{"emotion": "grief", "intensity": 0.6}])
    assert style == "Watercolor"


async def test_build_prompt_low_intensity_returns_minimalist_style():
    _, style = await build_prompt_from_emotions([{"emotion": "calm", "intensity": 0.3}])
    assert style == "Minimalist"


async def test_build_prompt_unknown_emotion_uses_default_concept():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "unknownemotionxyz", "intensity": 0.5}])
    assert "unknownemotionxyz" in prompt


# ══════════════════════════════════════════════════════════════════════════
# 4 — Emotion extraction service (8 tests)
# ══════════════════════════════════════════════════════════════════════════

def _fake_emotion_response(emotions: list[dict] | None = None):
    if emotions is None:
        emotions = [{"emotion": "anxiety", "intensity": 0.8}]
    import json
    choice = MagicMock()
    choice.message.content = json.dumps(emotions)
    response = MagicMock()
    response.choices = [choice]
    return response


async def test_extract_emotions_returns_list():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_fake_emotion_response()):
        result = await extract_emotions("I feel really anxious about everything")
    assert isinstance(result, list)


async def test_extract_emotions_empty_text_returns_empty():
    result = await extract_emotions("")
    assert result == []


async def test_extract_emotions_short_text_skips_api():
    result = await extract_emotions("sad")
    assert result == []


async def test_extract_emotions_parses_emotion_and_intensity():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock,
               return_value=_fake_emotion_response([{"emotion": "worry", "intensity": 0.75}])):
        result = await extract_emotions("I keep worrying about the future all the time")
    assert len(result) == 1
    assert result[0]["emotion"] == "worry"
    assert result[0]["intensity"] == 0.75


async def test_extract_emotions_caps_at_3():
    many = [{"emotion": f"e{i}", "intensity": 0.5} for i in range(6)]
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_fake_emotion_response(many)):
        result = await extract_emotions("lots of different feelings at once today")
    assert len(result) <= 3


async def test_extract_emotions_clamps_intensity_to_valid_range():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock,
               return_value=_fake_emotion_response([{"emotion": "stress", "intensity": 2.5}])):
        result = await extract_emotions("absolutely beyond overwhelmed and stressed out")
    assert result[0]["intensity"] <= 1.0


async def test_extract_emotions_api_failure_returns_empty():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, side_effect=Exception("API error")):
        result = await extract_emotions("I feel very sad and overwhelmed right now")
    assert result == []


async def test_extract_emotions_invalid_json_returns_empty():
    choice = MagicMock()
    choice.message.content = "not valid json at all {{{"
    response = MagicMock()
    response.choices = [choice]
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=response):
        result = await extract_emotions("I feel very anxious about everything today")
    assert result == []


# ══════════════════════════════════════════════════════════════════════════
# 5 — Image service utilities (8 tests)
# ══════════════════════════════════════════════════════════════════════════

def test_make_thumbnail_returns_bytes():
    result = _make_thumbnail(_FAKE_PNG)
    assert isinstance(result, bytes) and len(result) > 0


def test_make_thumbnail_output_is_valid_png():
    result = _make_thumbnail(_FAKE_PNG)
    img = PILImage.open(io.BytesIO(result))
    assert img.format == "PNG"


def test_make_thumbnail_max_dimension_is_256():
    large_png = _make_valid_png(512, 512)
    result = _make_thumbnail(large_png)
    img = PILImage.open(io.BytesIO(result))
    assert max(img.size) <= 256


def test_provider_error_stores_provider_name():
    err = ProviderError("openai", "timeout")
    assert err.provider == "openai"


def test_provider_error_includes_provider_in_str():
    err = ProviderError("gemini", "rate limited")
    assert "gemini" in str(err)


def test_all_providers_failed_stores_error_list():
    errors = [ProviderError("openai", "a"), ProviderError("gemini", "b")]
    exc = AllProvidersFailed(errors)
    assert len(exc.errors) == 2


def test_all_providers_failed_message_includes_both():
    errors = [ProviderError("openai", "fail"), ProviderError("gemini", "fail")]
    exc = AllProvidersFailed(errors)
    msg = str(exc)
    assert "openai" in msg and "gemini" in msg


async def test_generate_one_image_raises_all_providers_failed():
    from app.services.image_service import _generate_one_image
    with (
        patch("app.services.image_service.openai_image.generate_image",
              new_callable=AsyncMock,
              side_effect=ProviderError("openai", "timeout")),
        patch("app.services.image_service.settings") as mock_s,
    ):
        mock_s.GEMINI_API_KEY = ""
        with pytest.raises(AllProvidersFailed):
            await _generate_one_image("test prompt")


# ══════════════════════════════════════════════════════════════════════════
# 6 — POST /generate — 200 happy path (15 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_generate_returns_200(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen1@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves of worry", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.status_code == 200


async def test_generate_response_has_session_id(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen2@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert "session_id" in resp.json()
    assert resp.json()["session_id"] is not None


async def test_generate_response_has_images_list(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen3@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    assert "images" in resp.json()
    assert isinstance(resp.json()["images"], list)


async def test_generate_count_2_returns_2_images(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen4@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    assert len(resp.json()["images"]) == 2


async def test_generate_count_1_returns_1_image(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen5@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert len(resp.json()["images"]) == 1


async def test_generate_each_image_has_id(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen6@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    for img in resp.json()["images"]:
        assert "id" in img and img["id"] is not None


async def test_generate_each_image_has_image_url(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen7@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    for img in resp.json()["images"]:
        assert "image_url" in img and img["image_url"]


async def test_generate_each_image_has_thumbnail_url(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen8@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert "thumbnail_url" in resp.json()["images"][0]


async def test_generate_each_image_has_prompt_used(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen9@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert "prompt_used" in resp.json()["images"][0]


async def test_generate_each_image_has_style_used(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen10@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.json()["images"][0]["style_used"] == "Watercolor"


async def test_generate_image_url_differs_from_thumbnail(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen11@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    img = resp.json()["images"][0]
    assert img["image_url"] != img["thumbnail_url"]


async def test_generate_creates_session_in_db(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen12@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(select(Session).where(Session.id == session_id))
    assert result.scalar_one_or_none() is not None


async def test_generate_session_has_source_create(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen13@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    assert session.source == "create"


async def test_generate_creates_image_rows_in_db(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen14@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(
        select(GeneratedImage).where(GeneratedImage.session_id == session_id)
    )
    images = result.scalars().all()
    assert len(images) == 2


async def test_generate_revised_prompt_stored_in_db(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "gen15@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    session_id = uuid.UUID(resp.json()["session_id"])
    result = await db.execute(
        select(GeneratedImage).where(GeneratedImage.session_id == session_id)
    )
    img = result.scalars().first()
    assert img.prompt_used == "A wave of worry"


# ══════════════════════════════════════════════════════════════════════════
# 7 — POST /generate — 202 fallback path (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_generate_returns_202_when_all_providers_fail(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail1@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.status_code == 202


async def test_generate_202_body_has_status_pending(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail2@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.json()["status"] == "pending"


async def test_generate_202_body_has_job_id(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail3@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert "job_id" in resp.json()


async def test_generate_202_job_id_is_valid_uuid(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail4@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    uuid.UUID(resp.json()["job_id"])  # raises ValueError if invalid


async def test_generate_creates_image_job_in_db(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail5@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    job_id = uuid.UUID(resp.json()["job_id"])
    job = await db.get(ImageJob, job_id)
    assert job is not None


async def test_generate_job_has_status_pending(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail6@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    job = await db.get(ImageJob, uuid.UUID(resp.json()["job_id"]))
    assert job.status == "pending"


async def test_generate_job_stores_style(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail7@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    job = await db.get(ImageJob, uuid.UUID(resp.json()["job_id"]))
    assert job.style == "Watercolor"


async def test_generate_job_stores_concept_id(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail8@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    job = await db.get(ImageJob, uuid.UUID(resp.json()["job_id"]))
    assert job.concept_id == concept_id


async def test_generate_job_stores_count(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail9@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 2},
            headers=headers)
    job = await db.get(ImageJob, uuid.UUID(resp.json()["job_id"]))
    assert job.count == 2


async def test_generate_job_includes_style_in_prompt(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "fail10@example.com")
    with _mocks_all_fail()[0], _mocks_all_fail()[1], _mocks_all_fail()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    job = await db.get(ImageJob, uuid.UUID(resp.json()["job_id"]))
    assert "Watercolor" in job.prompt


# ══════════════════════════════════════════════════════════════════════════
# 8 — GET /generate/status/{job_id} (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def _make_job(db: AsyncSession, user_id: uuid.UUID,
                    status: str = "pending", concept_id: uuid.UUID | None = None) -> ImageJob:
    if concept_id is None:
        concept_id = uuid.uuid4()
    job = ImageJob(
        user_id=user_id,
        prompt="test prompt",
        style="Watercolor",
        concept_id=concept_id,
        count=1,
        status=status,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def _get_user_id(client: AsyncClient, db: AsyncSession, email: str) -> uuid.UUID:
    from app.models.user import User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    return user.id


async def test_job_status_pending_returns_pending(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js1@example.com")
    user_id = await _get_user_id(client, db, "js1@example.com")
    job = await _make_job(db, user_id, "pending")
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.status_code == 200 and resp.json()["status"] == "pending"


async def test_job_status_succeeded_returns_succeeded(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js2@example.com")
    user_id = await _get_user_id(client, db, "js2@example.com")
    job = await _make_job(db, user_id, "succeeded")
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.json()["status"] == "succeeded"


async def test_job_status_failed_returns_failed(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js3@example.com")
    user_id = await _get_user_id(client, db, "js3@example.com")
    job = await _make_job(db, user_id, "failed")
    job.error = "Both providers timed out"
    await db.commit()
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.json()["status"] == "failed"


async def test_job_status_failed_includes_error(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js4@example.com")
    user_id = await _get_user_id(client, db, "js4@example.com")
    job = await _make_job(db, user_id, "failed")
    job.error = "provider timeout"
    await db.commit()
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.json()["error"] is not None


async def test_job_status_pending_has_empty_images(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js5@example.com")
    user_id = await _get_user_id(client, db, "js5@example.com")
    job = await _make_job(db, user_id, "pending")
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.json()["images"] == []


async def test_job_status_not_found_returns_404(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js6@example.com")
    fake_id = uuid.uuid4()
    resp = await client.get(f"/generate/status/{fake_id}", headers=headers)
    assert resp.status_code == 404


async def test_job_status_another_users_job_returns_404(client: AsyncClient, db: AsyncSession):
    headers_a = await _auth_headers(client, "js7a@example.com")
    headers_b = await _auth_headers(client, "js7b@example.com")
    user_id_a = await _get_user_id(client, db, "js7a@example.com")
    job = await _make_job(db, user_id_a, "pending")
    resp = await client.get(f"/generate/status/{job.id}", headers=headers_b)
    assert resp.status_code == 404


async def test_job_status_requires_auth(client: AsyncClient, db: AsyncSession):
    resp = await client.get(f"/generate/status/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_job_status_invalid_uuid_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "js9@example.com")
    resp = await client.get("/generate/status/not-a-uuid", headers=headers)
    assert resp.status_code == 422


async def test_job_status_succeeded_has_none_session_when_not_linked(
    client: AsyncClient, db: AsyncSession
):
    headers = await _auth_headers(client, "js10@example.com")
    user_id = await _get_user_id(client, db, "js10@example.com")
    job = await _make_job(db, user_id, "succeeded")  # no session_id attached
    resp = await client.get(f"/generate/status/{job.id}", headers=headers)
    assert resp.json()["session_id"] is None


# ══════════════════════════════════════════════════════════════════════════
# 9 — POST /generate/select (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def _generate_images(client, db, email, concept_id, count=2):
    headers = await _auth_headers(client, email)
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": count},
            headers=headers)
    return headers, resp.json()


async def test_select_image_returns_200(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel1@example.com", concept_id)
    resp = await client.post(SELECT_URL,
        json={"image_id": body["images"][0]["id"], "session_id": body["session_id"]},
        headers=headers)
    assert resp.status_code == 200


async def test_select_image_response_has_status_ok(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel2@example.com", concept_id)
    resp = await client.post(SELECT_URL,
        json={"image_id": body["images"][0]["id"], "session_id": body["session_id"]},
        headers=headers)
    assert resp.json()["status"] == "ok"


async def test_select_image_response_has_image_id(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel3@example.com", concept_id)
    image_id = body["images"][0]["id"]
    resp = await client.post(SELECT_URL,
        json={"image_id": image_id, "session_id": body["session_id"]},
        headers=headers)
    assert resp.json()["image_id"] == image_id


async def test_select_image_sets_is_selected_true(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel4@example.com", concept_id)
    image_id = uuid.UUID(body["images"][0]["id"])
    await client.post(SELECT_URL,
        json={"image_id": str(image_id), "session_id": body["session_id"]},
        headers=headers)
    img = await db.get(GeneratedImage, image_id)
    assert img.is_selected is True


async def test_select_image_deselects_others_in_session(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel5@example.com", concept_id, count=2)
    session_id = uuid.UUID(body["session_id"])
    select_id = uuid.UUID(body["images"][0]["id"])

    await client.post(SELECT_URL,
        json={"image_id": str(select_id), "session_id": str(session_id)},
        headers=headers)

    result = await db.execute(
        select(GeneratedImage).where(
            GeneratedImage.session_id == session_id,
            GeneratedImage.id != select_id,
        )
    )
    others = result.scalars().all()
    assert all(img.is_selected is False for img in others)


async def test_select_image_requires_auth(client: AsyncClient, db: AsyncSession):
    resp = await client.post(SELECT_URL,
        json={"image_id": str(uuid.uuid4()), "session_id": str(uuid.uuid4())})
    assert resp.status_code == 401


async def test_select_second_image_updates_selection(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers, body = await _generate_images(client, db, "sel7@example.com", concept_id, count=2)
    session_id = body["session_id"]
    first_id = body["images"][0]["id"]
    second_id = body["images"][1]["id"]

    await client.post(SELECT_URL, json={"image_id": first_id, "session_id": session_id}, headers=headers)
    await client.post(SELECT_URL, json={"image_id": second_id, "session_id": session_id}, headers=headers)

    first = await db.get(GeneratedImage, uuid.UUID(first_id))
    second = await db.get(GeneratedImage, uuid.UUID(second_id))
    assert first.is_selected is False
    assert second.is_selected is True


async def test_select_missing_image_id_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "sel8@example.com")
    resp = await client.post(SELECT_URL,
        json={"session_id": str(uuid.uuid4())}, headers=headers)
    assert resp.status_code == 422


async def test_select_missing_session_id_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "sel9@example.com")
    resp = await client.post(SELECT_URL,
        json={"image_id": str(uuid.uuid4())}, headers=headers)
    assert resp.status_code == 422


async def test_select_invalid_uuid_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "sel10@example.com")
    resp = await client.post(SELECT_URL,
        json={"image_id": "not-a-uuid", "session_id": "also-not-uuid"}, headers=headers)
    assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════
# 10 — Input validation (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_generate_missing_prompt_returns_422(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val1@example.com")
    resp = await client.post(GENERATE_URL,
        json={"style": "Watercolor", "concept_id": str(concept_id)},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_missing_style_returns_422(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val2@example.com")
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "concept_id": str(concept_id)},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_missing_concept_id_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "val3@example.com")
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor"},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_count_zero_returns_422(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val4@example.com")
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor",
              "concept_id": str(concept_id), "count": 0},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_count_five_returns_422(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val5@example.com")
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor",
              "concept_id": str(concept_id), "count": 5},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_invalid_concept_uuid_returns_422(client: AsyncClient, db: AsyncSession):
    headers = await _auth_headers(client, "val6@example.com")
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor",
              "concept_id": "not-a-uuid", "count": 1},
        headers=headers)
    assert resp.status_code == 422


async def test_generate_flagged_prompt_returns_400(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val7@example.com")
    with patch("app.services.image_service.check_moderation", new_callable=AsyncMock,
               return_value={"flagged": True, "categories": {"hate": True}, "message": "flagged"}):
        resp = await client.post(GENERATE_URL,
            json={"prompt": "harmful prompt", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.status_code == 400


async def test_generate_flagged_detail_mentions_flagged(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "val8@example.com")
    with patch("app.services.image_service.check_moderation", new_callable=AsyncMock,
               return_value={"flagged": True, "categories": {}, "message": "flagged"}):
        resp = await client.post(GENERATE_URL,
            json={"prompt": "harmful prompt", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert "flagged" in resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════
# 11 — Authorization checks (7 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_generate_no_token_returns_401(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor",
              "concept_id": str(concept_id), "count": 1})
    assert resp.status_code == 401


async def test_generate_invalid_token_returns_401(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    resp = await client.post(GENERATE_URL,
        json={"prompt": "waves", "style": "Watercolor",
              "concept_id": str(concept_id), "count": 1},
        headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401


async def test_select_no_token_returns_401(client: AsyncClient):
    resp = await client.post(SELECT_URL,
        json={"image_id": str(uuid.uuid4()), "session_id": str(uuid.uuid4())})
    assert resp.status_code == 401


async def test_select_invalid_token_returns_401(client: AsyncClient):
    resp = await client.post(SELECT_URL,
        json={"image_id": str(uuid.uuid4()), "session_id": str(uuid.uuid4())},
        headers={"Authorization": "Bearer bad.token"})
    assert resp.status_code == 401


async def test_job_status_no_token_returns_401(client: AsyncClient):
    resp = await client.get(f"/generate/status/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_job_status_invalid_token_returns_401(client: AsyncClient):
    resp = await client.get(f"/generate/status/{uuid.uuid4()}",
        headers={"Authorization": "Bearer bad.token"})
    assert resp.status_code == 401


async def test_generate_authenticated_user_can_generate(client: AsyncClient, db: AsyncSession):
    """Sanity check: authenticated users can successfully generate images."""
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client, "auth_ok@example.com")
    with _mocks_happy()[0], _mocks_happy()[1], _mocks_happy()[2]:
        resp = await client.post(GENERATE_URL,
            json={"prompt": "peaceful garden", "style": "Watercolor",
                  "concept_id": str(concept_id), "count": 1},
            headers=headers)
    assert resp.status_code == 200
