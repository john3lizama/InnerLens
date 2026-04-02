"""
concept.py — Concept and Style tables.

Concepts are the creative prompts users choose from (e.g., "Emotional Waves",
"A Safe Space"). Each concept has a prompt template with a [DROPDOWN] placeholder
that gets filled with the user's chosen emotion.

Styles are art styles (e.g., "Watercolor", "Abstract / Expressionist") that
get appended to the image prompt.

These are seeded from seed.py — users don't create them.
"""

import uuid
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.database import Base


class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Display fields ───────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String, nullable=False)

    # URL-friendly version of the title: "emotional-waves"
    # Used in routing and as a lookup key in emotion_map.py
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    # ── Prompt template ──────────────────────────────────────────────────
    # The template has a [DROPDOWN] placeholder that gets replaced with
    # the user's chosen emotion. Example:
    # "Create waves of [DROPDOWN] that rise and then gently fade into calm water."
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Dropdown config ──────────────────────────────────────────────────
    # The label shown above the dropdown: "Pick an Emotion"
    dropdown_label: Mapped[str] = mapped_column(String, nullable=False)

    # JSONB stores a Python list directly in Postgres as JSON.
    # Example: ["worry", "self-doubt", "longing", "hope"]
    # This is much cleaner than a separate table for dropdown options.
    dropdown_options: Mapped[list] = mapped_column(JSONB, nullable=False)

    # ── Reflection ───────────────────────────────────────────────────────
    # Shown after the user selects their final image.
    # Example: "What helps this feeling soften and settle over time?"
    reflection_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    # "core" for the 5 original concepts, "extended" for the 11 Aahil designs
    category: Mapped[str] = mapped_column(String, default="core")


class Style(Base):
    __tablename__ = "styles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Style fields ─────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    # Groups styles for the UI: "medium", "mood", "other"
    category: Mapped[str] = mapped_column(String, nullable=False)
