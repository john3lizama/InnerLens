"""
test_concepts.py — Tests for /concepts and /concepts/styles endpoints.

Seeds two concepts and two styles into the test DB, then verifies
the API returns them correctly.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.concept import Concept, Style


async def _seed_concepts(db: AsyncSession) -> None:
    db.add(Concept(
        id=uuid.uuid4(),
        title="Emotional Waves",
        slug="emotional-waves",
        prompt_template="Create waves of [DROPDOWN] that rise and then fade.",
        dropdown_label="Pick an Emotion",
        dropdown_options=["worry", "hope", "grief"],
        reflection_prompt="What helps this feeling soften over time?",
        category="core",
    ))
    db.add(Concept(
        id=uuid.uuid4(),
        title="A Safe Space",
        slug="a-safe-space",
        prompt_template="Visualize [DROPDOWN] as a space.",
        dropdown_label="Pick a Feeling",
        dropdown_options=["loneliness", "peace"],
        reflection_prompt="What would make this space feel more like home?",
        category="core",
    ))
    db.add(Style(id=uuid.uuid4(), name="Watercolor", category="medium"))
    db.add(Style(id=uuid.uuid4(), name="Minimalist", category="other"))
    await db.commit()


async def test_get_concepts_returns_list(client: AsyncClient, db: AsyncSession):
    await _seed_concepts(db)
    resp = await client.get("/concepts")
    assert resp.status_code == 200
    body = resp.json()
    assert "concepts" in body
    assert len(body["concepts"]) == 2
    slugs = {c["slug"] for c in body["concepts"]}
    assert "emotional-waves" in slugs
    assert "a-safe-space" in slugs


async def test_concepts_include_required_fields(client: AsyncClient, db: AsyncSession):
    await _seed_concepts(db)
    resp = await client.get("/concepts")
    concept = resp.json()["concepts"][0]
    for field in ("id", "title", "slug", "prompt_template",
                  "dropdown_label", "dropdown_options", "reflection_prompt", "category"):
        assert field in concept, f"Missing field: {field}"


async def test_get_styles_returns_list(client: AsyncClient, db: AsyncSession):
    await _seed_concepts(db)
    resp = await client.get("/concepts/styles")
    assert resp.status_code == 200
    body = resp.json()
    assert "styles" in body
    assert len(body["styles"]) == 2
    names = {s["name"] for s in body["styles"]}
    assert "Watercolor" in names
    assert "Minimalist" in names


async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
