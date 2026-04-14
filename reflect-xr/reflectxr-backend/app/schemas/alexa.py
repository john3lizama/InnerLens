"""
alexa.py schemas — Response models for the Alexa gallery endpoint.
"""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AlexaGalleryImage(BaseModel):
    id: UUID
    image_url: str
    thumbnail_url: str | None = None
    created_at: datetime


class AlexaGalleryItem(BaseModel):
    session_id: UUID
    created_at: datetime
    emotion_tags: list[dict] | None = None
    images: list[AlexaGalleryImage]


class AlexaGalleryResponse(BaseModel):
    items: list[AlexaGalleryItem]
    count: int
