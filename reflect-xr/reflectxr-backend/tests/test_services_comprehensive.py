"""
test_services_comprehensive.py — Category 5: Services, Safety & AI Modules

100 pure-unit tests — no database, no HTTP client required.
All async tests use asyncio_mode = auto (pytest.ini).

Sections:
  1.  check_crisis — keyword detection              (14)
  2.  check_moderation — OpenAI moderation API      (10)
  3.  valence_of — explicit table lookups           (14)
  4.  valence_of — substring heuristic fallback     (8)
  5.  build_prompt_from_emotions — prompt builder   (14)
  6.  extract_emotions — GPT integration            (12)
  7.  auth_service — password hashing               (8)
  8.  auth_service — JWT token creation             (12)
  9.  emotion_map — data integrity                  (8)
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from jose import jwt

from app.ai.safety import check_crisis, check_moderation, CRISIS_KEYWORDS, CRISIS_RESPONSE
from app.ai.emotion_valence import valence_of, EMOTION_VALENCE
from app.ai.emotion_map import EMOTION_TO_CONCEPT, DEFAULT_CONCEPT
from app.services.prompt_builder import build_prompt_from_emotions
from app.services.emotion_service import extract_emotions
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_token_pair,
    ACCESS_TOKEN_MINUTES,
    REFRESH_TOKEN_DAYS,
)
from app.config import settings


# ── Helpers ───────────────────────────────────────────────────────────────

def _mock_moderation_result(flagged: bool, categories: dict | None = None):
    mock_result = MagicMock()
    mock_result.flagged = flagged
    if flagged:
        mock_cats = MagicMock()
        mock_cats.model_dump.return_value = categories or {"hate": False, "violence": True}
        mock_result.categories = mock_cats
    mock_response = MagicMock()
    mock_response.results = [mock_result]
    return mock_response


def _mock_gpt_response(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _expired_token(user_id: uuid.UUID | None = None) -> str:
    uid = user_id or uuid.uuid4()
    payload = {
        "sub": str(uid),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ═══════════════════════════════════════════════════════════════════════════
# Section 1 — check_crisis: Keyword detection (14 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_crisis_safe_text_returns_none():
    assert check_crisis("I had a great day at the park") is None


def test_crisis_empty_string_returns_none():
    assert check_crisis("") is None


def test_crisis_detects_suicide():
    assert check_crisis("I'm thinking about suicide") is not None


def test_crisis_detects_kill_myself():
    assert check_crisis("I want to kill myself") is not None


def test_crisis_detects_hurt_myself():
    assert check_crisis("I keep wanting to hurt myself") is not None


def test_crisis_detects_end_my_life():
    assert check_crisis("I want to end my life") is not None


def test_crisis_detects_want_to_die():
    assert check_crisis("I want to die") is not None


def test_crisis_detects_self_harm():
    assert check_crisis("I've been self-harm ing") is not None


def test_crisis_detects_overdose():
    assert check_crisis("thinking about an overdose") is not None


def test_crisis_case_insensitive():
    assert check_crisis("SUICIDE is on my mind") is not None


def test_crisis_mixed_case():
    assert check_crisis("Kill Myself is all I think about") is not None


def test_crisis_returns_crisis_response_string():
    result = check_crisis("I want to die")
    assert result == CRISIS_RESPONSE


def test_crisis_response_contains_988():
    assert "988" in CRISIS_RESPONSE


def test_crisis_keyword_embedded_in_sentence():
    assert check_crisis("sometimes when life is hard I think about suicide at night") is not None


# ═══════════════════════════════════════════════════════════════════════════
# Section 2 — check_moderation: OpenAI moderation API (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_moderation_clean_text_returns_unflagged():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=False)):
        result = await check_moderation("a peaceful sunset over calm water")
    assert result["flagged"] is False


async def test_moderation_unflagged_message_is_none():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=False)):
        result = await check_moderation("calm art prompt")
    assert result["message"] is None


async def test_moderation_unflagged_categories_is_none():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=False)):
        result = await check_moderation("neutral text")
    assert result["categories"] is None


async def test_moderation_flagged_returns_true():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=True)):
        result = await check_moderation("violent content here")
    assert result["flagged"] is True


async def test_moderation_flagged_has_message():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=True)):
        result = await check_moderation("bad content")
    assert result["message"] is not None and len(result["message"]) > 0


async def test_moderation_flagged_has_categories():
    cats = {"hate": True, "violence": False}
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=True, categories=cats)):
        result = await check_moderation("hateful text")
    assert result["categories"] == cats


async def test_moderation_api_exception_fails_open():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               side_effect=Exception("API down")):
        result = await check_moderation("any text")
    assert result["flagged"] is False


async def test_moderation_exception_returns_none_message():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               side_effect=Exception("timeout")):
        result = await check_moderation("text")
    assert result["message"] is None


async def test_moderation_result_always_has_three_keys():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               return_value=_mock_moderation_result(flagged=False)):
        result = await check_moderation("some text")
    assert set(result.keys()) == {"flagged", "categories", "message"}


async def test_moderation_flagged_false_on_exception():
    with patch("app.ai.safety.client.moderations.create", new_callable=AsyncMock,
               side_effect=RuntimeError("network error")):
        result = await check_moderation("prompt text")
    assert result == {"flagged": False, "categories": None, "message": None}


# ═══════════════════════════════════════════════════════════════════════════
# Section 3 — valence_of: Explicit table lookups (14 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_valence_hope_positive():
    assert valence_of("hope") == 1


def test_valence_joy_positive():
    assert valence_of("joy") == 1


def test_valence_calm_positive():
    assert valence_of("calm") == 1


def test_valence_gratitude_positive():
    assert valence_of("gratitude") == 1


def test_valence_anxiety_negative():
    assert valence_of("anxiety") == -1


def test_valence_grief_negative():
    assert valence_of("grief") == -1


def test_valence_worry_negative():
    assert valence_of("worry") == -1


def test_valence_loneliness_negative():
    assert valence_of("loneliness") == -1


def test_valence_nostalgia_neutral():
    assert valence_of("nostalgia") == 0


def test_valence_change_neutral():
    assert valence_of("change") == 0


def test_valence_unknown_returns_zero():
    assert valence_of("xyzunknownemotionword") == 0


def test_valence_empty_string_returns_zero():
    assert valence_of("") == 0


def test_valence_case_insensitive_positive():
    assert valence_of("HOPE") == 1


def test_valence_case_insensitive_negative():
    assert valence_of("ANXIETY") == -1


# ═══════════════════════════════════════════════════════════════════════════
# Section 4 — valence_of: Substring heuristic fallback (8 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_valence_heuristic_hopeless_negative():
    assert valence_of("hopeless") == -1


def test_valence_heuristic_unhappy_negative():
    assert valence_of("unhappy") == -1


def test_valence_heuristic_joyful_positive():
    assert valence_of("joyful") == 1


def test_valence_heuristic_sadness_negative():
    assert valence_of("sadness") == -1


def test_valence_heuristic_hopeful_positive():
    assert valence_of("hopeful") == 1


def test_valence_heuristic_fearful_negative():
    assert valence_of("fearful") == -1


def test_valence_heuristic_grateful_positive():
    assert valence_of("grateful") == 1


def test_valence_heuristic_angry_negative():
    assert valence_of("angry") == -1


# ═══════════════════════════════════════════════════════════════════════════
# Section 5 — build_prompt_from_emotions: Prompt builder (14 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_build_prompt_returns_tuple():
    result = await build_prompt_from_emotions([{"emotion": "hope", "intensity": 0.7}])
    assert isinstance(result, tuple) and len(result) == 2


async def test_build_prompt_empty_emotions_uses_default():
    prompt, style = await build_prompt_from_emotions([])
    assert prompt == DEFAULT_CONCEPT["prompt_template"]


async def test_build_prompt_empty_emotions_style_watercolor():
    _, style = await build_prompt_from_emotions([])
    assert style == "Watercolor"


async def test_build_prompt_dropdown_replaced():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "hope", "intensity": 0.7}])
    assert "[DROPDOWN]" not in prompt
    assert "hope" in prompt


async def test_build_prompt_anxiety_maps_emotional_waves():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "anxiety", "intensity": 0.6}])
    assert "waves" in prompt.lower()


async def test_build_prompt_hope_maps_bright_horizon():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "hope", "intensity": 0.6}])
    assert "horizon" in prompt.lower() or "sun" in prompt.lower()


async def test_build_prompt_grief_maps_safe_space():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "grief", "intensity": 0.6}])
    assert "space" in prompt.lower() or "vast" in prompt.lower()


async def test_build_prompt_stress_maps_weight():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "stress", "intensity": 0.6}])
    assert "heavy" in prompt.lower() or "weight" in prompt.lower() or "carrying" in prompt.lower()


async def test_build_prompt_high_intensity_abstract_style():
    _, style = await build_prompt_from_emotions([{"emotion": "anxiety", "intensity": 0.9}])
    assert style == "Abstract / Expressionist"


async def test_build_prompt_medium_intensity_watercolor_style():
    _, style = await build_prompt_from_emotions([{"emotion": "hope", "intensity": 0.7}])
    assert style == "Watercolor"


async def test_build_prompt_low_intensity_minimalist_style():
    _, style = await build_prompt_from_emotions([{"emotion": "calm", "intensity": 0.4}])
    assert style == "Minimalist"


async def test_build_prompt_dominant_chosen_by_intensity():
    emotions = [
        {"emotion": "anxiety", "intensity": 0.9},
        {"emotion": "hope", "intensity": 0.3},
    ]
    prompt, _ = await build_prompt_from_emotions(emotions)
    assert "anxiety" in prompt


async def test_build_prompt_unknown_emotion_uses_default_template():
    prompt, _ = await build_prompt_from_emotions([{"emotion": "xyzunknown", "intensity": 0.5}])
    assert "xyzunknown" in prompt


async def test_build_prompt_intensity_boundary_0_81_abstract():
    _, style = await build_prompt_from_emotions([{"emotion": "worry", "intensity": 0.81}])
    assert style == "Abstract / Expressionist"


# ═══════════════════════════════════════════════════════════════════════════
# Section 6 — extract_emotions: GPT integration (12 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_extract_emotions_short_text_returns_empty():
    result = await extract_emotions("hi")
    assert result == []


async def test_extract_emotions_empty_string_returns_empty():
    result = await extract_emotions("")
    assert result == []


async def test_extract_emotions_whitespace_only_returns_empty():
    result = await extract_emotions("   ")
    assert result == []


async def test_extract_emotions_returns_list():
    emotions_json = '[{"emotion": "hope", "intensity": 0.8}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("I feel so hopeful about tomorrow")
    assert isinstance(result, list)


async def test_extract_emotions_happy_path():
    emotions_json = '[{"emotion": "hope", "intensity": 0.8}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("I feel so hopeful about tomorrow")
    assert result == [{"emotion": "hope", "intensity": 0.8}]


async def test_extract_emotions_lowercases_emotion():
    emotions_json = '[{"emotion": "Hope", "intensity": 0.7}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("feeling hopeful and bright today")
    assert result[0]["emotion"] == "hope"


async def test_extract_emotions_clamps_intensity_above_1():
    emotions_json = '[{"emotion": "joy", "intensity": 1.5}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("overwhelmingly joyful and bright today")
    assert result[0]["intensity"] == 1.0


async def test_extract_emotions_clamps_intensity_below_0():
    emotions_json = '[{"emotion": "calm", "intensity": -0.3}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("feeling quite calm and at ease today")
    assert result[0]["intensity"] == 0.0


async def test_extract_emotions_max_three_returned():
    emotions_json = json.dumps([
        {"emotion": "hope", "intensity": 0.9},
        {"emotion": "joy", "intensity": 0.8},
        {"emotion": "calm", "intensity": 0.7},
        {"emotion": "love", "intensity": 0.6},
    ])
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("a very long emotional reflection with many feelings")
    assert len(result) <= 3


async def test_extract_emotions_json_error_returns_empty():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response("not valid json {")):
        result = await extract_emotions("I feel things deeply inside of me right now")
    assert result == []


async def test_extract_emotions_api_exception_returns_empty():
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, side_effect=Exception("OpenAI down")):
        result = await extract_emotions("I feel really anxious about everything today")
    assert result == []


async def test_extract_emotions_filters_items_missing_keys():
    emotions_json = '[{"emotion": "hope"}, {"emotion": "calm", "intensity": 0.5}]'
    with patch("app.services.emotion_service.client.chat.completions.create",
               new_callable=AsyncMock, return_value=_mock_gpt_response(emotions_json)):
        result = await extract_emotions("feeling hopeful and calm and collected today")
    assert len(result) == 1
    assert result[0]["emotion"] == "calm"


# ═══════════════════════════════════════════════════════════════════════════
# Section 7 — auth_service: Password hashing (8 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_hash_password_returns_string():
    assert isinstance(hash_password("MyPass123!"), str)


def test_hash_password_starts_with_bcrypt_prefix():
    hashed = hash_password("TestPass!")
    assert hashed.startswith("$2")


def test_hash_password_two_calls_different_hashes():
    h1 = hash_password("SamePassword1!")
    h2 = hash_password("SamePassword1!")
    assert h1 != h2


def test_verify_password_correct_returns_true():
    hashed = hash_password("CorrectPass1!")
    assert verify_password("CorrectPass1!", hashed) is True


def test_verify_password_wrong_returns_false():
    hashed = hash_password("RightPass1!")
    assert verify_password("WrongPass1!", hashed) is False


def test_verify_password_empty_returns_false():
    hashed = hash_password("SomePass1!")
    assert verify_password("", hashed) is False


def test_verify_password_case_sensitive():
    hashed = hash_password("password123")
    assert verify_password("Password123", hashed) is False


def test_hash_password_not_plaintext():
    pw = "MySecret99!"
    hashed = hash_password(pw)
    assert pw not in hashed


# ═══════════════════════════════════════════════════════════════════════════
# Section 8 — auth_service: JWT token creation (12 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_create_access_token_returns_string():
    assert isinstance(create_access_token(uuid.uuid4()), str)


def test_create_access_token_payload_sub_matches_user_id():
    uid = uuid.uuid4()
    token = create_access_token(uid)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(uid)


def test_create_access_token_type_is_access():
    token = create_access_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "access"


def test_create_access_token_expiry_approx_30_minutes():
    before = datetime.now(timezone.utc)
    token = create_access_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    delta = exp - before
    assert timedelta(minutes=29) < delta < timedelta(minutes=31)


def test_create_refresh_token_returns_string():
    assert isinstance(create_refresh_token(uuid.uuid4()), str)


def test_create_refresh_token_type_is_refresh():
    token = create_refresh_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "refresh"


def test_create_refresh_token_expiry_approx_30_days():
    before = datetime.now(timezone.utc)
    token = create_refresh_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    delta = exp - before
    assert timedelta(days=29) < delta < timedelta(days=31)


def test_create_token_pair_has_all_keys():
    pair = create_token_pair(uuid.uuid4())
    assert set(pair.keys()) == {"access_token", "refresh_token", "token_type"}


def test_create_token_pair_token_type_bearer():
    pair = create_token_pair(uuid.uuid4())
    assert pair["token_type"] == "bearer"


def test_create_token_pair_access_type_is_access():
    uid = uuid.uuid4()
    pair = create_token_pair(uid)
    payload = jwt.decode(pair["access_token"], settings.JWT_SECRET,
                         algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "access"


def test_create_token_pair_refresh_type_is_refresh():
    uid = uuid.uuid4()
    pair = create_token_pair(uid)
    payload = jwt.decode(pair["refresh_token"], settings.JWT_SECRET,
                         algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "refresh"


def test_different_users_get_different_tokens():
    t1 = create_access_token(uuid.uuid4())
    t2 = create_access_token(uuid.uuid4())
    assert t1 != t2


# ═══════════════════════════════════════════════════════════════════════════
# Section 9 — emotion_map: Data integrity (8 tests)
# ═══════════════════════════════════════════════════════════════════════════

def test_emotion_map_nonempty():
    assert len(EMOTION_TO_CONCEPT) > 0


def test_emotion_map_all_entries_have_concept_key():
    for emotion, entry in EMOTION_TO_CONCEPT.items():
        assert "concept" in entry, f"Missing 'concept' for '{emotion}'"


def test_emotion_map_all_entries_have_prompt_template():
    for emotion, entry in EMOTION_TO_CONCEPT.items():
        assert "prompt_template" in entry, f"Missing 'prompt_template' for '{emotion}'"


def test_emotion_map_all_templates_contain_dropdown():
    for emotion, entry in EMOTION_TO_CONCEPT.items():
        assert "[DROPDOWN]" in entry["prompt_template"], \
            f"'[DROPDOWN]' missing in template for '{emotion}'"


def test_emotion_map_default_concept_has_required_keys():
    assert "concept" in DEFAULT_CONCEPT
    assert "prompt_template" in DEFAULT_CONCEPT


def test_emotion_map_default_concept_has_dropdown():
    assert "[DROPDOWN]" in DEFAULT_CONCEPT["prompt_template"]


def test_emotion_map_worry_maps_emotional_waves():
    assert EMOTION_TO_CONCEPT["worry"]["concept"] == "emotional-waves"


def test_emotion_map_hope_maps_bright_horizon():
    assert EMOTION_TO_CONCEPT["hope"]["concept"] == "bright-horizon"
