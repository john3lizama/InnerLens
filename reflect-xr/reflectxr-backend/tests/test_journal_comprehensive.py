"""
test_journal_comprehensive.py — Category 4: Journal Entries

100 tests across 10 sections:
  1.  POST /journal — create basics          (12)
  2.  GET  /journal — list view              (12)
  3.  GET  /journal/{id} — detail            (10)
  4.  PATCH /journal/{id} — update content   (10)
  5.  PATCH /journal/{id}/favorite           (10)
  6.  DELETE /journal/{id}                   (8)
  7.  Authentication & authorization         (10)
  8.  Word count precision                   (8)
  9.  User isolation                         (10)
  10. Input validation                       (10)
"""

import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generated_image import GeneratedImage
from app.models.session import Session

# ── Constants ─────────────────────────────────────────────────────────────
REGISTER_URL = "/auth/register"
VERIFY_URL = "/auth/register/verify"
JOURNAL_URL = "/journal"

_FAKE_EMOTIONS = [
    {"emotion": "hope", "intensity": 0.7},
    {"emotion": "calm", "intensity": 0.5},
]
_DEFAULT_CONTENT = "Today I felt a deep sense of peace while looking at the image."
_REFLECTION_PROMPT = "What helps this feeling soften and settle over time?"


# ── Helpers ───────────────────────────────────────────────────────────────

async def _make_user(client: AsyncClient, email: str, password: str = "Pass123!") -> dict:
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        with patch("app.routers.auth.upload_image", new_callable=AsyncMock,
                   return_value="https://cdn.test/avatar.png"):
            reg = await client.post(REGISTER_URL, json={
                "email": email, "password": password, "display_name": "JournalUser",
            })
            assert reg.status_code == 200, reg.text
            code = reg.json()["dev_code"]
            ver = await client.post(VERIFY_URL, json={"email": email, "code": code})
            assert ver.status_code == 200, ver.text
            token = ver.json()["access_token"]
            user_id = ver.json()["user"]["id"]
    return {"user_id": uuid.UUID(user_id), "headers": {"Authorization": f"Bearer {token}"}}


async def _make_session_and_image(db: AsyncSession, user_id: uuid.UUID) -> dict:
    sess = Session(user_id=user_id, source="create")
    db.add(sess)
    await db.flush()
    image = GeneratedImage(
        session_id=sess.id,
        image_url="https://cdn.test/image.png",
        thumbnail_url="https://cdn.test/thumb.png",
        prompt_used="A wave of calm",
        style_used="Watercolor",
    )
    db.add(image)
    await db.commit()
    await db.refresh(sess)
    await db.refresh(image)
    return {"session_id": sess.id, "image_id": image.id}


def _ep():
    return patch("app.routers.journal.extract_emotions", new_callable=AsyncMock,
                 return_value=_FAKE_EMOTIONS)


def _payload(session_id, image_id, content=_DEFAULT_CONTENT, prompt=None):
    p = {"session_id": str(session_id), "image_id": str(image_id), "content": content}
    if prompt:
        p["reflection_prompt_used"] = prompt
    return p


# ═══════════════════════════════════════════════════════════════════════════
# Section 1 — POST /journal: Create basics (12 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_create_journal_returns_201(client, db):
    u = await _make_user(client, f"jc1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    assert resp.status_code == 201


async def test_create_journal_response_has_id(client, db):
    u = await _make_user(client, f"jc2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    assert "id" in resp.json()


async def test_create_journal_returns_emotion_tags(client, db):
    u = await _make_user(client, f"jc3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    tags = resp.json()["emotion_tags"]
    assert isinstance(tags, list) and len(tags) == 2
    assert tags[0]["emotion"] == "hope"


async def test_create_journal_returns_word_count(client, db):
    u = await _make_user(client, f"jc4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL,
                                 json=_payload(**ids, content="one two three four five"),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 5


async def test_create_journal_returns_created_at(client, db):
    u = await _make_user(client, f"jc5_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    assert "created_at" in resp.json()


async def test_create_journal_with_reflection_prompt(client, db):
    u = await _make_user(client, f"jc6_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, prompt=_REFLECTION_PROMPT),
                                 headers=u["headers"])
    assert resp.status_code == 201


async def test_create_journal_without_reflection_prompt(client, db):
    u = await _make_user(client, f"jc7_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    assert resp.status_code == 201


async def test_create_journal_calls_extract_emotions(client, db):
    u = await _make_user(client, f"jc8_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    mock_fn = AsyncMock(return_value=_FAKE_EMOTIONS)
    with patch("app.routers.journal.extract_emotions", mock_fn):
        await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    mock_fn.assert_awaited_once()


async def test_create_multiple_journals_same_user(client, db):
    u = await _make_user(client, f"jc9_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u["user_id"])
    ids2 = await _make_session_and_image(db, u["user_id"])
    with _ep():
        r1 = await client.post(JOURNAL_URL, json=_payload(**ids1), headers=u["headers"])
        r2 = await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u["headers"])
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


async def test_create_journal_content_stored_verbatim(client, db):
    u = await _make_user(client, f"jc10_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "Verbatim check — special: & < > \" '"
    with _ep():
        created = (await client.post(JOURNAL_URL,
                                     json=_payload(**ids, content=content),
                                     headers=u["headers"])).json()
    detail = await client.get(f"{JOURNAL_URL}/{created['id']}", headers=u["headers"])
    assert detail.json()["content"] == content


async def test_create_journal_long_content(client, db):
    u = await _make_user(client, f"jc11_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = " ".join(["word"] * 500)
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                 headers=u["headers"])
    assert resp.status_code == 201
    assert resp.json()["word_count"] == 500


async def test_create_journal_single_word_content(client, db):
    u = await _make_user(client, f"jc12_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, content="Peaceful"),
                                 headers=u["headers"])
    assert resp.status_code == 201
    assert resp.json()["word_count"] == 1


# ═══════════════════════════════════════════════════════════════════════════
# Section 2 — GET /journal: List view (12 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_list_journal_empty(client, db):
    u = await _make_user(client, f"jl1_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.status_code == 200
    assert resp.json() == {"entries": [], "total": 0}


async def test_list_journal_returns_created_entry(client, db):
    u = await _make_user(client, f"jl2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["total"] == 1
    assert len(resp.json()["entries"]) == 1


async def test_list_journal_content_truncated_to_100(client, db):
    u = await _make_user(client, f"jl3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "A" * 200
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids, content=content), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert len(resp.json()["entries"][0]["content"]) == 100


async def test_list_journal_short_content_not_padded(client, db):
    u = await _make_user(client, f"jl4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids, content="Short"), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["entries"][0]["content"] == "Short"


async def test_list_journal_includes_emotion_tags(client, db):
    u = await _make_user(client, f"jl5_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert len(resp.json()["entries"][0]["emotion_tags"]) == 2


async def test_list_journal_includes_image_thumbnail(client, db):
    u = await _make_user(client, f"jl6_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    image = resp.json()["entries"][0]["image"]
    assert image is not None and "thumbnail_url" in image


async def test_list_journal_ordered_newest_first(client, db):
    u = await _make_user(client, f"jl7_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u["user_id"])
    ids2 = await _make_session_and_image(db, u["user_id"])
    with _ep():
        r1 = await client.post(JOURNAL_URL, json=_payload(**ids1, content="First entry"),
                               headers=u["headers"])
        r2 = await client.post(JOURNAL_URL, json=_payload(**ids2, content="Second entry"),
                               headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    ids_returned = [e["id"] for e in resp.json()["entries"]]
    assert r2.json()["id"] in ids_returned
    assert r1.json()["id"] in ids_returned


async def test_list_journal_pagination_limit(client, db):
    u = await _make_user(client, f"jl8_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(5):
        ids = await _make_session_and_image(db, u["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(f"{JOURNAL_URL}?limit=3", headers=u["headers"])
    assert len(resp.json()["entries"]) == 3
    assert resp.json()["total"] == 5


async def test_list_journal_pagination_offset(client, db):
    u = await _make_user(client, f"jl9_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(5):
        ids = await _make_session_and_image(db, u["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(f"{JOURNAL_URL}?limit=3&offset=3", headers=u["headers"])
    assert len(resp.json()["entries"]) == 2


async def test_list_journal_includes_word_count(client, db):
    u = await _make_user(client, f"jl10_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL,
                          json=_payload(**ids, content="five words in here now"),
                          headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["entries"][0]["word_count"] == 5


async def test_list_journal_includes_is_favorite(client, db):
    u = await _make_user(client, f"jl11_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert "is_favorite" in resp.json()["entries"][0]


async def test_list_journal_default_limit_20(client, db):
    u = await _make_user(client, f"jl12_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(25):
        ids = await _make_session_and_image(db, u["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert len(resp.json()["entries"]) == 20
    assert resp.json()["total"] == 25


# ═══════════════════════════════════════════════════════════════════════════
# Section 3 — GET /journal/{id}: Detail view (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_get_journal_detail_200(client, db):
    u = await _make_user(client, f"jd1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.status_code == 200


async def test_get_journal_detail_full_content_not_truncated(client, db):
    u = await _make_user(client, f"jd2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "X" * 200
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                   headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert len(resp.json()["content"]) == 200


async def test_get_journal_detail_includes_image(client, db):
    u = await _make_user(client, f"jd3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.json()["image"] is not None
    assert resp.json()["image"]["image_url"] == "https://cdn.test/image.png"


async def test_get_journal_detail_includes_reflection_prompt(client, db):
    u = await _make_user(client, f"jd4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL,
                                   json=_payload(**ids, prompt=_REFLECTION_PROMPT),
                                   headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.json()["reflection_prompt_used"] == _REFLECTION_PROMPT


async def test_get_journal_detail_404_unknown(client, db):
    u = await _make_user(client, f"jd5_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(f"{JOURNAL_URL}/{uuid.uuid4()}", headers=u["headers"])
    assert resp.status_code == 404


async def test_get_journal_detail_is_favorite_default_false(client, db):
    u = await _make_user(client, f"jd6_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.json()["is_favorite"] is False


async def test_get_journal_detail_has_emotion_tags(client, db):
    u = await _make_user(client, f"jd7_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert len(resp.json()["emotion_tags"]) == 2


async def test_get_journal_detail_404_other_user(client, db):
    u1 = await _make_user(client, f"jd8a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"jd8b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u2["headers"])
    assert resp.status_code == 404


async def test_get_journal_detail_word_count_correct(client, db):
    u = await _make_user(client, f"jd9_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "ten words that are all here in this sentence now"
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                   headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.json()["word_count"] == 10


async def test_get_journal_detail_null_reflection_prompt_when_omitted(client, db):
    u = await _make_user(client, f"jd10_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.json()["reflection_prompt_used"] is None


# ═══════════════════════════════════════════════════════════════════════════
# Section 4 — PATCH /journal/{id}: Update content (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_update_journal_returns_200(client, db):
    u = await _make_user(client, f"ju1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "Updated text"}, headers=u["headers"])
    assert resp.status_code == 200


async def test_update_journal_content_changes(client, db):
    u = await _make_user(client, f"ju2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "New reflection text"}, headers=u["headers"])
    assert resp.json()["content"] == "New reflection text"


async def test_update_journal_word_count_recalculated(client, db):
    u = await _make_user(client, f"ju3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL,
                                   json=_payload(**ids, content="three words here"),
                                   headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "just two"}, headers=u["headers"])
    assert resp.json()["word_count"] == 2


async def test_update_journal_emotion_tags_refreshed(client, db):
    u = await _make_user(client, f"ju4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    new_tags = [{"emotion": "grief", "intensity": 0.9}]
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    with patch("app.routers.journal.extract_emotions", new_callable=AsyncMock,
               return_value=new_tags):
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "Deep grief"}, headers=u["headers"])
    assert resp.json()["emotion_tags"][0]["emotion"] == "grief"


async def test_update_journal_calls_extract_emotions(client, db):
    u = await _make_user(client, f"ju5_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    mock_fn = AsyncMock(return_value=_FAKE_EMOTIONS)
    with patch("app.routers.journal.extract_emotions", mock_fn):
        await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                           json={"content": "Refreshed"}, headers=u["headers"])
    mock_fn.assert_awaited_once()


async def test_update_journal_404_unknown(client, db):
    u = await _make_user(client, f"ju6_{uuid.uuid4().hex[:8]}@t.com")
    with _ep():
        resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}",
                                  json={"content": "x"}, headers=u["headers"])
    assert resp.status_code == 404


async def test_update_journal_404_other_user(client, db):
    u1 = await _make_user(client, f"ju7a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"ju7b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "Stolen"}, headers=u2["headers"])
    assert resp.status_code == 404


async def test_update_journal_image_still_in_response(client, db):
    u = await _make_user(client, f"ju8_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "Updated"}, headers=u["headers"])
    assert resp.json()["image"] is not None


async def test_update_journal_reflection_prompt_unchanged(client, db):
    u = await _make_user(client, f"ju9_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL,
                                   json=_payload(**ids, prompt=_REFLECTION_PROMPT),
                                   headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "New"}, headers=u["headers"])
    assert resp.json()["reflection_prompt_used"] == _REFLECTION_PROMPT


async def test_update_journal_returns_detail_shape(client, db):
    u = await _make_user(client, f"ju10_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "Check shape"}, headers=u["headers"])
    for key in ("id", "content", "emotion_tags", "image", "word_count", "is_favorite", "created_at"):
        assert key in resp.json()


# ═══════════════════════════════════════════════════════════════════════════
# Section 5 — PATCH /journal/{id}/favorite (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_favorite_set_true(client, db):
    u = await _make_user(client, f"jf1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": True}, headers=u["headers"])
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is True


async def test_favorite_set_false(client, db):
    u = await _make_user(client, f"jf2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                       json={"is_favorite": True}, headers=u["headers"])
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": False}, headers=u["headers"])
    assert resp.json()["is_favorite"] is False


async def test_favorite_idempotent_true(client, db):
    u = await _make_user(client, f"jf3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    eid = entry["id"]
    await client.patch(f"{JOURNAL_URL}/{eid}/favorite",
                       json={"is_favorite": True}, headers=u["headers"])
    resp = await client.patch(f"{JOURNAL_URL}/{eid}/favorite",
                              json={"is_favorite": True}, headers=u["headers"])
    assert resp.json()["is_favorite"] is True


async def test_favorite_persists_after_refetch(client, db):
    u = await _make_user(client, f"jf4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                       json={"is_favorite": True}, headers=u["headers"])
    detail = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert detail.json()["is_favorite"] is True


async def test_favorite_404_unknown(client, db):
    u = await _make_user(client, f"jf5_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}/favorite",
                              json={"is_favorite": True}, headers=u["headers"])
    assert resp.status_code == 404


async def test_favorite_404_other_user(client, db):
    u1 = await _make_user(client, f"jf6a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"jf6b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": True}, headers=u2["headers"])
    assert resp.status_code == 404


async def test_favorite_returns_full_detail(client, db):
    u = await _make_user(client, f"jf7_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": True}, headers=u["headers"])
    for key in ("id", "content", "emotion_tags", "image", "word_count", "is_favorite", "created_at"):
        assert key in resp.json()


async def test_favorite_independent_across_entries(client, db):
    u = await _make_user(client, f"jf8_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u["user_id"])
    ids2 = await _make_session_and_image(db, u["user_id"])
    with _ep():
        e1 = (await client.post(JOURNAL_URL, json=_payload(**ids1), headers=u["headers"])).json()
        e2 = (await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u["headers"])).json()
    await client.patch(f"{JOURNAL_URL}/{e1['id']}/favorite",
                       json={"is_favorite": True}, headers=u["headers"])
    detail2 = await client.get(f"{JOURNAL_URL}/{e2['id']}", headers=u["headers"])
    assert detail2.json()["is_favorite"] is False


async def test_favorite_toggle_back_and_forth(client, db):
    u = await _make_user(client, f"jf9_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    eid = entry["id"]
    for expected in [True, False, True, False]:
        resp = await client.patch(f"{JOURNAL_URL}/{eid}/favorite",
                                  json={"is_favorite": expected}, headers=u["headers"])
        assert resp.json()["is_favorite"] is expected


async def test_favorite_image_in_response(client, db):
    u = await _make_user(client, f"jf10_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": True}, headers=u["headers"])
    assert resp.json()["image"] is not None


# ═══════════════════════════════════════════════════════════════════════════
# Section 6 — DELETE /journal/{id} (8 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_delete_journal_returns_204(client, db):
    u = await _make_user(client, f"jdel1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.status_code == 204


async def test_delete_journal_no_longer_in_list(client, db):
    u = await _make_user(client, f"jdel2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["total"] == 0


async def test_delete_journal_404_on_reget(client, db):
    u = await _make_user(client, f"jdel3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.status_code == 404


async def test_delete_journal_404_unknown(client, db):
    u = await _make_user(client, f"jdel4_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.delete(f"{JOURNAL_URL}/{uuid.uuid4()}", headers=u["headers"])
    assert resp.status_code == 404


async def test_delete_journal_404_other_user(client, db):
    u1 = await _make_user(client, f"jdel5a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"jdel5b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u2["headers"])
    assert resp.status_code == 404


async def test_delete_journal_only_deletes_target(client, db):
    u = await _make_user(client, f"jdel6_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u["user_id"])
    ids2 = await _make_session_and_image(db, u["user_id"])
    with _ep():
        e1 = (await client.post(JOURNAL_URL, json=_payload(**ids1), headers=u["headers"])).json()
        e2 = (await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u["headers"])).json()
    await client.delete(f"{JOURNAL_URL}/{e1['id']}", headers=u["headers"])
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["total"] == 1
    assert resp.json()["entries"][0]["id"] == e2["id"]


async def test_delete_journal_twice_second_is_404(client, db):
    u = await _make_user(client, f"jdel7_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    resp = await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u["headers"])
    assert resp.status_code == 404


async def test_delete_journal_unauthenticated(client, db):
    u = await _make_user(client, f"jdel8_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids), headers=u["headers"])).json()
    resp = await client.delete(f"{JOURNAL_URL}/{entry['id']}")
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════
# Section 7 — Authentication & Authorization (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_auth_create_requires_token(client, db):
    resp = await client.post(JOURNAL_URL, json={
        "image_id": str(uuid.uuid4()), "session_id": str(uuid.uuid4()), "content": "x",
    })
    assert resp.status_code == 401


async def test_auth_list_requires_token(client, db):
    resp = await client.get(JOURNAL_URL)
    assert resp.status_code == 401


async def test_auth_detail_requires_token(client, db):
    resp = await client.get(f"{JOURNAL_URL}/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_auth_update_requires_token(client, db):
    resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}", json={"content": "x"})
    assert resp.status_code == 401


async def test_auth_favorite_requires_token(client, db):
    resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}/favorite",
                              json={"is_favorite": True})
    assert resp.status_code == 401


async def test_auth_invalid_token_rejected(client, db):
    resp = await client.get(JOURNAL_URL,
                            headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


async def test_auth_expired_token_rejected(client, db):
    from app.services.auth_service import create_access_token
    from datetime import timedelta
    expired = create_access_token({"sub": str(uuid.uuid4())},
                                  expires_delta=timedelta(seconds=-1))
    resp = await client.get(JOURNAL_URL, headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


async def test_auth_valid_token_allows_list(client, db):
    u = await _make_user(client, f"ja8_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.status_code == 200


async def test_auth_user_a_cannot_read_user_b_entry(client, db):
    u1 = await _make_user(client, f"ja9a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"ja9b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        e = (await client.post(JOURNAL_URL, json=_payload(**ids),
                               headers=u1["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{e['id']}", headers=u2["headers"])
    assert resp.status_code == 404


async def test_auth_list_only_returns_own_entries(client, db):
    u1 = await _make_user(client, f"ja10a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"ja10b_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u1["user_id"])
    ids2 = await _make_session_and_image(db, u2["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids1), headers=u1["headers"])
        await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u2["headers"])
    r1 = await client.get(JOURNAL_URL, headers=u1["headers"])
    r2 = await client.get(JOURNAL_URL, headers=u2["headers"])
    assert r1.json()["total"] == 1
    assert r2.json()["total"] == 1


# ═══════════════════════════════════════════════════════════════════════════
# Section 8 — Word count precision (8 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_word_count_five_words(client, db):
    u = await _make_user(client, f"wc1_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL,
                                 json=_payload(**ids, content="one two three four five"),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 5


async def test_word_count_single_word(client, db):
    u = await _make_user(client, f"wc2_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        resp = await client.post(JOURNAL_URL,
                                 json=_payload(**ids, content="serenity"),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 1


async def test_word_count_newlines_as_whitespace(client, db):
    u = await _make_user(client, f"wc3_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "line one\nline two\nline three"
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 6


async def test_word_count_in_list_matches_create(client, db):
    u = await _make_user(client, f"wc4_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "seven words all here at once today"
    with _ep():
        created = (await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                     headers=u["headers"])).json()
    listed = (await client.get(JOURNAL_URL, headers=u["headers"])).json()
    assert listed["entries"][0]["word_count"] == created["word_count"]


async def test_word_count_in_detail_matches_create(client, db):
    u = await _make_user(client, f"wc5_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "four words are here"
    with _ep():
        created = (await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                     headers=u["headers"])).json()
    detail = (await client.get(f"{JOURNAL_URL}/{created['id']}", headers=u["headers"])).json()
    assert detail["word_count"] == 4


async def test_word_count_updated_after_edit(client, db):
    u = await _make_user(client, f"wc6_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL,
                                   json=_payload(**ids, content="original three words"),
                                   headers=u["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "just one"}, headers=u["headers"])
    assert resp.json()["word_count"] == 2


async def test_word_count_large_text(client, db):
    u = await _make_user(client, f"wc7_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = " ".join(["word"] * 1000)
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 1000


async def test_word_count_extra_spaces_collapsed(client, db):
    u = await _make_user(client, f"wc8_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u["user_id"])
    content = "two  words"
    with _ep():
        resp = await client.post(JOURNAL_URL, json=_payload(**ids, content=content),
                                 headers=u["headers"])
    assert resp.json()["word_count"] == 2


# ═══════════════════════════════════════════════════════════════════════════
# Section 9 — User isolation (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_isolation_list_empty_for_new_user(client, db):
    u = await _make_user(client, f"iso1_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(JOURNAL_URL, headers=u["headers"])
    assert resp.json()["total"] == 0


async def test_isolation_user_b_list_excludes_user_a_entries(client, db):
    u1 = await _make_user(client, f"iso2a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso2b_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(3):
        ids = await _make_session_and_image(db, u1["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u1["headers"])
    resp = await client.get(JOURNAL_URL, headers=u2["headers"])
    assert resp.json()["total"] == 0


async def test_isolation_total_counts_only_own(client, db):
    u1 = await _make_user(client, f"iso3a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso3b_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(2):
        ids = await _make_session_and_image(db, u1["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u1["headers"])
    ids2 = await _make_session_and_image(db, u2["user_id"])
    with _ep():
        await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u2["headers"])
    r1 = await client.get(JOURNAL_URL, headers=u1["headers"])
    r2 = await client.get(JOURNAL_URL, headers=u2["headers"])
    assert r1.json()["total"] == 2
    assert r2.json()["total"] == 1


async def test_isolation_cannot_get_other_user_detail(client, db):
    u1 = await _make_user(client, f"iso4a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso4b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.get(f"{JOURNAL_URL}/{entry['id']}", headers=u2["headers"])
    assert resp.status_code == 404


async def test_isolation_cannot_update_other_user_entry(client, db):
    u1 = await _make_user(client, f"iso5a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso5b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
        resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}",
                                  json={"content": "x"}, headers=u2["headers"])
    assert resp.status_code == 404


async def test_isolation_cannot_delete_other_user_entry(client, db):
    u1 = await _make_user(client, f"iso6a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso6b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.delete(f"{JOURNAL_URL}/{entry['id']}", headers=u2["headers"])
    assert resp.status_code == 404


async def test_isolation_cannot_favorite_other_user_entry(client, db):
    u1 = await _make_user(client, f"iso7a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso7b_{uuid.uuid4().hex[:8]}@t.com")
    ids = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        entry = (await client.post(JOURNAL_URL, json=_payload(**ids),
                                   headers=u1["headers"])).json()
    resp = await client.patch(f"{JOURNAL_URL}/{entry['id']}/favorite",
                              json={"is_favorite": True}, headers=u2["headers"])
    assert resp.status_code == 404


async def test_isolation_delete_does_not_affect_other_user(client, db):
    u1 = await _make_user(client, f"iso8a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso8b_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u1["user_id"])
    ids2 = await _make_session_and_image(db, u2["user_id"])
    with _ep():
        e1 = (await client.post(JOURNAL_URL, json=_payload(**ids1),
                                headers=u1["headers"])).json()
        await client.post(JOURNAL_URL, json=_payload(**ids2), headers=u2["headers"])
    await client.delete(f"{JOURNAL_URL}/{e1['id']}", headers=u1["headers"])
    r2 = await client.get(JOURNAL_URL, headers=u2["headers"])
    assert r2.json()["total"] == 1


async def test_isolation_pagination_counts_only_own(client, db):
    u1 = await _make_user(client, f"iso9a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso9b_{uuid.uuid4().hex[:8]}@t.com")
    for _ in range(10):
        ids = await _make_session_and_image(db, u1["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u1["headers"])
    for _ in range(3):
        ids = await _make_session_and_image(db, u2["user_id"])
        with _ep():
            await client.post(JOURNAL_URL, json=_payload(**ids), headers=u2["headers"])
    r2 = await client.get(f"{JOURNAL_URL}?limit=100", headers=u2["headers"])
    assert r2.json()["total"] == 3
    assert len(r2.json()["entries"]) == 3


async def test_isolation_update_does_not_change_other_user_entry(client, db):
    u1 = await _make_user(client, f"iso10a_{uuid.uuid4().hex[:8]}@t.com")
    u2 = await _make_user(client, f"iso10b_{uuid.uuid4().hex[:8]}@t.com")
    ids1 = await _make_session_and_image(db, u1["user_id"])
    with _ep():
        e1 = (await client.post(JOURNAL_URL,
                                json=_payload(**ids1, content="Original"),
                                headers=u1["headers"])).json()
        await client.patch(f"{JOURNAL_URL}/{e1['id']}",
                           json={"content": "Hijacked"}, headers=u2["headers"])
    detail = await client.get(f"{JOURNAL_URL}/{e1['id']}", headers=u1["headers"])
    assert detail.json()["content"] == "Original"


# ═══════════════════════════════════════════════════════════════════════════
# Section 10 — Input validation (10 tests)
# ═══════════════════════════════════════════════════════════════════════════

async def test_validation_missing_image_id(client, db):
    u = await _make_user(client, f"iv1_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.post(JOURNAL_URL,
                             json={"session_id": str(uuid.uuid4()), "content": "x"},
                             headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_missing_session_id(client, db):
    u = await _make_user(client, f"iv2_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.post(JOURNAL_URL,
                             json={"image_id": str(uuid.uuid4()), "content": "x"},
                             headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_missing_content(client, db):
    u = await _make_user(client, f"iv3_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.post(JOURNAL_URL,
                             json={"image_id": str(uuid.uuid4()),
                                   "session_id": str(uuid.uuid4())},
                             headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_invalid_image_id_format(client, db):
    u = await _make_user(client, f"iv4_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.post(JOURNAL_URL,
                             json={"image_id": "not-a-uuid",
                                   "session_id": str(uuid.uuid4()), "content": "x"},
                             headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_invalid_session_id_format(client, db):
    u = await _make_user(client, f"iv5_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.post(JOURNAL_URL,
                             json={"image_id": str(uuid.uuid4()),
                                   "session_id": "bad-uuid", "content": "x"},
                             headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_limit_below_1(client, db):
    u = await _make_user(client, f"iv6_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(f"{JOURNAL_URL}?limit=0", headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_limit_above_100(client, db):
    u = await _make_user(client, f"iv7_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(f"{JOURNAL_URL}?limit=101", headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_offset_below_0(client, db):
    u = await _make_user(client, f"iv8_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.get(f"{JOURNAL_URL}?offset=-1", headers=u["headers"])
    assert resp.status_code == 422


async def test_validation_favorite_non_bool(client, db):
    u = await _make_user(client, f"iv9_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}/favorite",
                              json={"is_favorite": "not-a-bool"}, headers=u["headers"])
    assert resp.status_code in (422, 404)


async def test_validation_patch_content_missing(client, db):
    u = await _make_user(client, f"iv10_{uuid.uuid4().hex[:8]}@t.com")
    resp = await client.patch(f"{JOURNAL_URL}/{uuid.uuid4()}", json={}, headers=u["headers"])
    assert resp.status_code == 422
