"""
concepts.py router — Serves the seeded concepts and styles.

These are read-only endpoints. The data comes from seed.py.
Mohammed's frontend calls these to populate the ConceptsScreen
and the style dropdown on PromptDesignScreen.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.concept import Concept, Style
from app.schemas.concept import (
    ConceptListResponse, ConceptResponse,
    StyleListResponse, StyleResponse
)

router = APIRouter()


@router.get("", response_model=ConceptListResponse)
async def get_concepts(db: AsyncSession = Depends(get_db)):
    """
    GET /concepts — Return all seeded concepts.

    Each concept includes its prompt template, dropdown options,
    and reflection prompt. The frontend renders these as cards
    the user can browse and select from.
    """
    result = await db.execute(select(Concept))
    concepts = result.scalars().all()
    return ConceptListResponse(concepts=concepts)


@router.get("/styles", response_model=StyleListResponse)
async def get_styles(db: AsyncSession = Depends(get_db)):
    """
    GET /concepts/styles — Return all art styles grouped by category.

    Categories: "medium" (Watercolor, Oil Painting...),
    "mood" (Dreamlike, Dark...), "other" (Minimalist, Pixel Art...)
    """
    result = await db.execute(select(Style))
    styles = result.scalars().all()
    return StyleListResponse(styles=styles)
