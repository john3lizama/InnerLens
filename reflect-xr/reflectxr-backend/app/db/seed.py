"""
seed.py — Populate the database with concepts and styles.

Run with: docker-compose exec api python -m app.db.seed

IDEMPOTENT: Checks if data exists before inserting, so you can
run it multiple times safely without creating duplicates.

The 5 core concepts have full templates from the project brief.
The 11 extended concepts are placeholders for Aahil to fill in.
"""

import asyncio
from sqlalchemy import select
from app.db.database import engine, async_session, Base
from app.models.concept import Concept, Style


# ══════════════════════════════════════════════════════════════════════════
# CONCEPT DATA — 5 core + 11 extended
# ══════════════════════════════════════════════════════════════════════════
CONCEPTS = [
    # ── Core 5 (full templates from the brief) ───────────────────────────
    {
        "title": "Emotional Waves",
        "slug": "emotional-waves",
        "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
        "dropdown_label": "Pick an Emotion",
        "dropdown_options": ["worry", "self-doubt", "longing", "hope", "grief", "anger"],
        "reflection_prompt": "What helps this feeling or state soften and settle over time?",
        "category": "core",
    },
    {
        "title": "A Safe Space",
        "slug": "a-safe-space",
        "prompt_template": "Visualize [DROPDOWN] as a space \u2014 vast, empty, or waiting.",
        "dropdown_label": "Pick a Feeling",
        "dropdown_options": ["loneliness", "grief", "isolation", "peace", "comfort"],
        "reflection_prompt": "What would make this space feel more like home?",
        "category": "core",
    },
    {
        "title": "Bright Horizon",
        "slug": "bright-horizon",
        "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon.",
        "dropdown_label": "Pick an Emotion",
        "dropdown_options": ["hope", "joy", "optimism", "relief", "freedom"],
        "reflection_prompt": "What is one thing you are looking forward to?",
        "category": "core",
    },
    {
        "title": "Inner Garden",
        "slug": "inner-garden",
        "prompt_template": "Illustrate [DROPDOWN] as a colorful garden that grows when tended.",
        "dropdown_label": "Pick a Quality",
        "dropdown_options": ["gratitude", "peace", "patience", "self-love", "kindness"],
        "reflection_prompt": "What in your life deserves more of your care and attention?",
        "category": "core",
    },
    {
        "title": "The Weight I Carry",
        "slug": "the-weight-i-carry",
        "prompt_template": "Depict [DROPDOWN] as a heavy object the person is carrying on a long road.",
        "dropdown_label": "Pick a Burden",
        "dropdown_options": ["stress", "burnout", "overwhelm", "responsibility", "guilt"],
        "reflection_prompt": "What would it feel like to set this weight down, even for a moment?",
        "category": "core",
    },

    # ── Extended 11 (Aahil designs the templates) ────────────────────────
    {
        "title": "Resilience",
        "slug": "resilience",
        "prompt_template": "Show [DROPDOWN] as a tree that bends in a storm but does not break.",
        "dropdown_label": "Pick a Strength",
        "dropdown_options": ["courage", "determination", "adaptability"],
        "reflection_prompt": "When have you surprised yourself with your own strength?",
        "category": "extended",
    },
    {
        "title": "Journey",
        "slug": "journey",
        "prompt_template": "Illustrate [DROPDOWN] as a winding path through changing landscapes.",
        "dropdown_label": "Pick a Theme",
        "dropdown_options": ["growth", "change", "nostalgia", "discovery"],
        "reflection_prompt": "What has your journey taught you so far?",
        "category": "extended",
    },
    {
        "title": "Masks We Wear",
        "slug": "masks-we-wear",
        "prompt_template": "Show [DROPDOWN] as a mask being slowly removed to reveal light underneath.",
        "dropdown_label": "Pick a Facade",
        "dropdown_options": ["pretending", "hiding", "performing", "protecting"],
        "reflection_prompt": "What would it feel like to take the mask off?",
        "category": "extended",
    },
    {
        "title": "Crossroads",
        "slug": "crossroads",
        "prompt_template": "Depict [DROPDOWN] as a fork in a road with two very different paths.",
        "dropdown_label": "Pick a Dilemma",
        "dropdown_options": ["confusion", "indecision", "fear of change", "opportunity"],
        "reflection_prompt": "What is guiding your decision right now?",
        "category": "extended",
    },
    {
        "title": "Future Self",
        "slug": "future-self",
        "prompt_template": "Visualize [DROPDOWN] as a letter written to your future self, glowing with light.",
        "dropdown_label": "Pick a Hope",
        "dropdown_options": ["ambition", "healing", "confidence", "clarity"],
        "reflection_prompt": "What do you want your future self to remember about this moment?",
        "category": "extended",
    },
    {
        "title": "Bridges",
        "slug": "bridges",
        "prompt_template": "Show [DROPDOWN] as a bridge being built between two cliffs.",
        "dropdown_label": "Pick a Connection",
        "dropdown_options": ["trust", "forgiveness", "communication", "understanding"],
        "reflection_prompt": "Who or what are you trying to reach?",
        "category": "extended",
    },
    {
        "title": "Friendship",
        "slug": "friendship",
        "prompt_template": "Illustrate [DROPDOWN] as two figures walking side by side through a colorful forest.",
        "dropdown_label": "Pick a Bond",
        "dropdown_options": ["loyalty", "support", "laughter", "belonging"],
        "reflection_prompt": "What makes your closest friendships meaningful?",
        "category": "extended",
    },
    {
        "title": "Growing Roots",
        "slug": "growing-roots",
        "prompt_template": "Show [DROPDOWN] as deep roots spreading underground while a small plant pushes through soil.",
        "dropdown_label": "Pick a Foundation",
        "dropdown_options": ["stability", "identity", "home", "tradition"],
        "reflection_prompt": "Where do you feel most grounded?",
        "category": "extended",
    },
    {
        "title": "Letting Go",
        "slug": "letting-go",
        "prompt_template": "Depict [DROPDOWN] as a balloon being released into a wide open sky.",
        "dropdown_label": "Pick Something to Release",
        "dropdown_options": ["regret", "control", "perfectionism", "resentment"],
        "reflection_prompt": "What are you holding onto that no longer serves you?",
        "category": "extended",
    },
    {
        "title": "Garden of Peace",
        "slug": "garden-of-peace",
        "prompt_template": "Visualize [DROPDOWN] as a quiet garden with a still pond reflecting the sky.",
        "dropdown_label": "Pick a State",
        "dropdown_options": ["calm", "contentment", "acceptance", "stillness"],
        "reflection_prompt": "When was the last time you felt truly at peace?",
        "category": "extended",
    },
    {
        "title": "Rising from Ashes",
        "slug": "rising-from-ashes",
        "prompt_template": "Show [DROPDOWN] as a phoenix rising from embers into a bright sky.",
        "dropdown_label": "Pick a Rebirth",
        "dropdown_options": ["transformation", "recovery", "renewal", "second chance"],
        "reflection_prompt": "What part of you is ready to be reborn?",
        "category": "extended",
    },
]

# ══════════════════════════════════════════════════════════════════════════
# STYLE DATA — 20 styles grouped by category
# ══════════════════════════════════════════════════════════════════════════
STYLES = [
    # Medium-based styles
    {"name": "Watercolor", "category": "medium"},
    {"name": "Oil Painting", "category": "medium"},
    {"name": "Pencil Sketch", "category": "medium"},
    {"name": "Charcoal Drawing", "category": "medium"},
    {"name": "Digital Illustration", "category": "medium"},
    {"name": "Collage", "category": "medium"},
    {"name": "Pixel Art", "category": "medium"},

    # Mood-based styles
    {"name": "Dreamlike / Surreal", "category": "mood"},
    {"name": "Dark / Moody", "category": "mood"},
    {"name": "Warm / Golden", "category": "mood"},
    {"name": "Cool / Ethereal", "category": "mood"},
    {"name": "Vibrant / Bold", "category": "mood"},
    {"name": "Soft / Pastel", "category": "mood"},

    # Other styles
    {"name": "Abstract / Expressionist", "category": "other"},
    {"name": "Minimalist", "category": "other"},
    {"name": "Impressionist", "category": "other"},
    {"name": "Art Nouveau", "category": "other"},
    {"name": "Japanese Ink Wash", "category": "other"},
    {"name": "Stained Glass", "category": "other"},
    {"name": "Geometric", "category": "other"},
]


async def seed():
    """Main seed function. Idempotent — safe to run multiple times."""
    # Create all tables if they don't exist yet
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ── Seed concepts ────────────────────────────────────────────────
        existing = await db.execute(select(Concept))
        if not existing.scalars().first():
            for concept_data in CONCEPTS:
                db.add(Concept(**concept_data))
            await db.commit()
            print(f"[seed] Inserted {len(CONCEPTS)} concepts")
        else:
            print("[seed] Concepts already exist \u2014 skipping")

        # ── Seed styles ──────────────────────────────────────────────────
        existing = await db.execute(select(Style))
        if not existing.scalars().first():
            for style_data in STYLES:
                db.add(Style(**style_data))
            await db.commit()
            print(f"[seed] Inserted {len(STYLES)} styles")
        else:
            print("[seed] Styles already exist \u2014 skipping")

    print("[seed] Done!")


# Allow running directly: python -m app.db.seed
if __name__ == "__main__":
    asyncio.run(seed())
