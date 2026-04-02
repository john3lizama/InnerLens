"""
concept.py schemas — Validates data for /concepts and /styles endpoints.

These are read-only (no create/update from the API — they're seeded).
"""

from pydantic import BaseModel
from uuid import UUID


class ConceptResponse(BaseModel):
    """One concept in the list returned by GET /concepts."""
    id: UUID
    title: str
    slug: str
    prompt_template: str
    dropdown_label: str
    dropdown_options: list[str]     # The emotions the user can pick from
    reflection_prompt: str
    category: str

    model_config = {"from_attributes": True}


class ConceptListResponse(BaseModel):
    """GET /concepts — Wraps the list so the JSON has a clear top-level key."""
    concepts: list[ConceptResponse]


class StyleResponse(BaseModel):
    """One style in the list returned by GET /styles."""
    id: UUID
    name: str
    category: str

    model_config = {"from_attributes": True}


class StyleListResponse(BaseModel):
    """GET /styles — Same wrapping pattern."""
    styles: list[StyleResponse]
