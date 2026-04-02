"""
chat.py schemas — Validates data for /chat endpoints (MindMate).

The chat flow:
1. User sends a message -> POST /chat
2. AI responds with empathetic reply + emotion tags
3. If emotions are strong enough -> should_generate_image = True
4. Frontend calls POST /chat/generate-from-conversation to get art
"""

from pydantic import BaseModel
from uuid import UUID


# ── Shared types ─────────────────────────────────────────────────────────

class EmotionTag(BaseModel):
    """One detected emotion with its intensity (0.0 to 1.0)."""
    emotion: str
    intensity: float


# ── Request schemas ──────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """POST /chat — Send a message to MindMate."""
    session_id: UUID | None = None    # None = start a new conversation
    message: str


class ChatGenerateRequest(BaseModel):
    """POST /chat/generate-from-conversation — Auto-generate art from chat."""
    session_id: UUID


# ── Response schemas ─────────────────────────────────────────────────────

class ChatResponse(BaseModel):
    """POST /chat — MindMate's reply."""
    session_id: UUID
    reply: str                               # The AI's empathetic response
    emotion_tags: list[EmotionTag]           # Detected emotions
    mode_detected: str                       # "check-in", "grounding", or "reflection"
    should_generate_image: bool              # True if auto-generation should trigger
    is_crisis: bool                          # True if crisis keywords detected


class ChatGenerateResponse(BaseModel):
    """POST /chat/generate-from-conversation — The auto-generated artwork."""
    image: dict                              # {id, image_url, prompt_used, style_used}
    emotion_summary: list[EmotionTag]
