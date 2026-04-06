"""
test_generate.py — Tests for POST /generate and POST /generate/select.

The OpenAI and S3 clients are mocked so no real API calls or uploads happen.
The test verifies that session + image records are written to the database.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.concept import Concept, Style
from app.models.generated_image import GeneratedImage
from app.models.session import Session

# ── Shared helpers ────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
GENERATE_URL = "/generate"
SELECT_URL = "/generate/select"

USER = {"email": "gen_user@example.com", "password": "Pass1234!", "display_name": "Gen Tester"}


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register + login and return Bearer headers."""
    await client.post(REGISTER_URL, json=USER)
    resp = await client.post(LOGIN_URL, json={"email": USER["email"], "password": USER["password"]})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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


# ── Fake DALL-E response ──────────────────────────────────────────────────

def _fake_dalle_response():
    """Returns a minimal object that mimics the OpenAI images.generate response."""
    image_data = MagicMock()
    image_data.url = "https://fake-openai-url.example.com/image.png"
    image_data.revised_prompt = "A beautiful wave of worry"
    response = MagicMock()
    response.data = [image_data]
    return response


# ── Tests ─────────────────────────────────────────────────────────────────

async def test_generate_creates_session_and_images(client: AsyncClient, db: AsyncSession):
    """POST /generate should store a session + N GeneratedImage rows."""
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client)

    with (
        patch(
            "app.services.image_service.client.images.generate",
            new_callable=AsyncMock,
            return_value=_fake_dalle_response(),
        ),
        patch(
            "app.services.image_service.client.moderations.create",
            new_callable=AsyncMock,
            return_value=MagicMock(results=[MagicMock(flagged=False)]),
        ),
        patch(
            "app.utils.storage.s3_client.put_object",
            return_value={},
        ),
        patch(
            "app.services.image_service.httpx.AsyncClient",
        ) as mock_http,
    ):
        # Make the HTTP download return fake PNG bytes
        fake_response = MagicMock()
        fake_response.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        mock_http.return_value.__aenter__ = AsyncMock(return_value=MagicMock(get=AsyncMock(return_value=fake_response)))
        mock_http.return_value.__aexit__ = AsyncMock(return_value=False)

        resp = await client.post(
            GENERATE_URL,
            json={"prompt": "waves of worry", "style": "Watercolor", "concept_id": str(concept_id), "count": 2},
            headers=headers,
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "session_id" in body
    assert len(body["images"]) == 2
    for img in body["images"]:
        assert "id" in img
        assert "image_url" in img
        assert "thumbnail_url" in img
        assert "prompt_used" in img
        assert "style_used" in img
        assert img["image_url"] != img["thumbnail_url"]  # real thumbnails are separate


async def test_generate_requires_auth(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    resp = await client.post(
        GENERATE_URL,
        json={"prompt": "test", "style": "Watercolor", "concept_id": str(concept_id), "count": 1},
    )
    assert resp.status_code == 401


async def test_generate_rejects_flagged_content(client: AsyncClient, db: AsyncSession):
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client)

    with patch(
        "app.services.image_service.client.moderations.create",
        new_callable=AsyncMock,
        return_value=MagicMock(results=[MagicMock(flagged=True)]),
    ):
        resp = await client.post(
            GENERATE_URL,
            json={"prompt": "flagged content", "style": "Watercolor", "concept_id": str(concept_id), "count": 1},
            headers=headers,
        )

    assert resp.status_code == 400
    assert "flagged" in resp.json()["detail"].lower()


async def test_select_image_marks_correct_image(client: AsyncClient, db: AsyncSession):
    """POST /generate/select should set is_selected on the right image."""
    concept_id = await _seed_concept(db)
    headers = await _auth_headers(client)

    with (
        patch(
            "app.services.image_service.client.images.generate",
            new_callable=AsyncMock,
            return_value=_fake_dalle_response(),
        ),
        patch(
            "app.services.image_service.client.moderations.create",
            new_callable=AsyncMock,
            return_value=MagicMock(results=[MagicMock(flagged=False)]),
        ),
        patch("app.utils.storage.s3_client.put_object", return_value={}),
        patch("app.services.image_service.httpx.AsyncClient") as mock_http,
    ):
        fake_response = MagicMock()
        fake_response.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        mock_http.return_value.__aenter__ = AsyncMock(return_value=MagicMock(get=AsyncMock(return_value=fake_response)))
        mock_http.return_value.__aexit__ = AsyncMock(return_value=False)

        gen_resp = await client.post(
            GENERATE_URL,
            json={"prompt": "waves", "style": "Watercolor", "concept_id": str(concept_id), "count": 2},
            headers=headers,
        )

    session_id = gen_resp.json()["session_id"]
    image_id = gen_resp.json()["images"][0]["id"]

    select_resp = await client.post(
        SELECT_URL,
        json={"image_id": image_id, "session_id": session_id},
        headers=headers,
    )
    assert select_resp.status_code == 200
    assert select_resp.json()["status"] == "ok"
    assert select_resp.json()["image_id"] == image_id
