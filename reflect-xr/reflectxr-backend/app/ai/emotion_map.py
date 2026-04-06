"""
emotion_map.py — Maps emotion keywords to concept prompt templates.

Used by prompt_builder.py to auto-generate image prompts from
detected emotions during MindMate conversations.

HOW TO EXTEND:
When Aahil designs the remaining 11 concept templates, add new
entries here mapping relevant emotions to those concepts.
"""

# Default fallback concept if the detected emotion doesn't match any key
DEFAULT_CONCEPT = {
    "concept": "inner-garden",
    "prompt_template": (
        "Illustrate [DROPDOWN] as a colorful garden that grows when tended."
    ),
}

# Maps emotion keywords -> concept templates
# Each emotion can only map to one concept (the best fit)
EMOTION_TO_CONCEPT = {
    # ── Emotional Waves ──────────────────────────────────────────────────
    "worry": {
        "concept": "emotional-waves",
        "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
    },
    "anxiety": {
        "concept": "emotional-waves",
        "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
    },
    "self-doubt": {
        "concept": "emotional-waves",
        "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
    },
    "longing": {
        "concept": "emotional-waves",
        "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
    },

    # ── A Safe Space ─────────────────────────────────────────────────────
    "loneliness": {
        "concept": "a-safe-space",
        "prompt_template": "Visualize [DROPDOWN] as a space — vast, empty, or waiting.",
    },
    "grief": {
        "concept": "a-safe-space",
        "prompt_template": "Visualize [DROPDOWN] as a space — vast, empty, or waiting.",
    },
    "isolation": {
        "concept": "a-safe-space",
        "prompt_template": "Visualize [DROPDOWN] as a space — vast, empty, or waiting.",
    },

    # ── Bright Horizon ───────────────────────────────────────────────────
    "hope": {
        "concept": "bright-horizon",
        "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon.",
    },
    "joy": {
        "concept": "bright-horizon",
        "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon.",
    },
    "optimism": {
        "concept": "bright-horizon",
        "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon.",
    },

    # ── Inner Garden ─────────────────────────────────────────────────────
    "gratitude": {
        "concept": "inner-garden",
        "prompt_template": "Illustrate [DROPDOWN] as a colorful garden that grows when tended.",
    },
    "peace": {
        "concept": "inner-garden",
        "prompt_template": "Illustrate [DROPDOWN] as a colorful garden that grows when tended.",
    },

    # ── The Weight I Carry ───────────────────────────────────────────────
    "stress": {
        "concept": "the-weight-i-carry",
        "prompt_template": "Depict [DROPDOWN] as a heavy object the person is carrying on a long road.",
    },
    "burnout": {
        "concept": "the-weight-i-carry",
        "prompt_template": "Depict [DROPDOWN] as a heavy object the person is carrying on a long road.",
    },
    "overwhelm": {
        "concept": "the-weight-i-carry",
        "prompt_template": "Depict [DROPDOWN] as a heavy object the person is carrying on a long road.",
    },

    # ── Resilience ───────────────────────────────────────────────────────
    "courage": {
        "concept": "resilience",
        "prompt_template": "Show [DROPDOWN] as a tree that bends in a storm but does not break.",
    },
    "determination": {
        "concept": "resilience",
        "prompt_template": "Show [DROPDOWN] as a tree that bends in a storm but does not break.",
    },
    "adaptability": {
        "concept": "resilience",
        "prompt_template": "Show [DROPDOWN] as a tree that bends in a storm but does not break.",
    },

    # ── Journey ──────────────────────────────────────────────────────────
    "growth": {
        "concept": "journey",
        "prompt_template": "Illustrate [DROPDOWN] as a winding path through changing landscapes.",
    },
    "change": {
        "concept": "journey",
        "prompt_template": "Illustrate [DROPDOWN] as a winding path through changing landscapes.",
    },
    "nostalgia": {
        "concept": "journey",
        "prompt_template": "Illustrate [DROPDOWN] as a winding path through changing landscapes.",
    },
    "discovery": {
        "concept": "journey",
        "prompt_template": "Illustrate [DROPDOWN] as a winding path through changing landscapes.",
    },

    # ── Masks We Wear ────────────────────────────────────────────────────
    "pretending": {
        "concept": "masks-we-wear",
        "prompt_template": "Show [DROPDOWN] as a mask being slowly removed to reveal light underneath.",
    },
    "hiding": {
        "concept": "masks-we-wear",
        "prompt_template": "Show [DROPDOWN] as a mask being slowly removed to reveal light underneath.",
    },
    "performing": {
        "concept": "masks-we-wear",
        "prompt_template": "Show [DROPDOWN] as a mask being slowly removed to reveal light underneath.",
    },
    "protecting": {
        "concept": "masks-we-wear",
        "prompt_template": "Show [DROPDOWN] as a mask being slowly removed to reveal light underneath.",
    },

    # ── Crossroads ───────────────────────────────────────────────────────
    "confusion": {
        "concept": "crossroads",
        "prompt_template": "Depict [DROPDOWN] as a fork in a road with two very different paths.",
    },
    "indecision": {
        "concept": "crossroads",
        "prompt_template": "Depict [DROPDOWN] as a fork in a road with two very different paths.",
    },
    "fear of change": {
        "concept": "crossroads",
        "prompt_template": "Depict [DROPDOWN] as a fork in a road with two very different paths.",
    },
    "opportunity": {
        "concept": "crossroads",
        "prompt_template": "Depict [DROPDOWN] as a fork in a road with two very different paths.",
    },

    # ── Future Self ──────────────────────────────────────────────────────
    "ambition": {
        "concept": "future-self",
        "prompt_template": "Visualize [DROPDOWN] as a letter written to your future self, glowing with light.",
    },
    "healing": {
        "concept": "future-self",
        "prompt_template": "Visualize [DROPDOWN] as a letter written to your future self, glowing with light.",
    },
    "confidence": {
        "concept": "future-self",
        "prompt_template": "Visualize [DROPDOWN] as a letter written to your future self, glowing with light.",
    },
    "clarity": {
        "concept": "future-self",
        "prompt_template": "Visualize [DROPDOWN] as a letter written to your future self, glowing with light.",
    },

    # ── Bridges ──────────────────────────────────────────────────────────
    "trust": {
        "concept": "bridges",
        "prompt_template": "Show [DROPDOWN] as a bridge being built between two cliffs.",
    },
    "forgiveness": {
        "concept": "bridges",
        "prompt_template": "Show [DROPDOWN] as a bridge being built between two cliffs.",
    },
    "communication": {
        "concept": "bridges",
        "prompt_template": "Show [DROPDOWN] as a bridge being built between two cliffs.",
    },
    "understanding": {
        "concept": "bridges",
        "prompt_template": "Show [DROPDOWN] as a bridge being built between two cliffs.",
    },

    # ── Friendship ───────────────────────────────────────────────────────
    "loyalty": {
        "concept": "friendship",
        "prompt_template": "Illustrate [DROPDOWN] as two figures walking side by side through a colorful forest.",
    },
    "support": {
        "concept": "friendship",
        "prompt_template": "Illustrate [DROPDOWN] as two figures walking side by side through a colorful forest.",
    },
    "laughter": {
        "concept": "friendship",
        "prompt_template": "Illustrate [DROPDOWN] as two figures walking side by side through a colorful forest.",
    },
    "belonging": {
        "concept": "friendship",
        "prompt_template": "Illustrate [DROPDOWN] as two figures walking side by side through a colorful forest.",
    },

    # ── Growing Roots ────────────────────────────────────────────────────
    "stability": {
        "concept": "growing-roots",
        "prompt_template": "Show [DROPDOWN] as deep roots spreading underground while a small plant pushes through soil.",
    },
    "identity": {
        "concept": "growing-roots",
        "prompt_template": "Show [DROPDOWN] as deep roots spreading underground while a small plant pushes through soil.",
    },
    "home": {
        "concept": "growing-roots",
        "prompt_template": "Show [DROPDOWN] as deep roots spreading underground while a small plant pushes through soil.",
    },
    "tradition": {
        "concept": "growing-roots",
        "prompt_template": "Show [DROPDOWN] as deep roots spreading underground while a small plant pushes through soil.",
    },

    # ── Letting Go ───────────────────────────────────────────────────────
    "regret": {
        "concept": "letting-go",
        "prompt_template": "Depict [DROPDOWN] as a balloon being released into a wide open sky.",
    },
    "control": {
        "concept": "letting-go",
        "prompt_template": "Depict [DROPDOWN] as a balloon being released into a wide open sky.",
    },
    "perfectionism": {
        "concept": "letting-go",
        "prompt_template": "Depict [DROPDOWN] as a balloon being released into a wide open sky.",
    },
    "resentment": {
        "concept": "letting-go",
        "prompt_template": "Depict [DROPDOWN] as a balloon being released into a wide open sky.",
    },

    # ── Garden of Peace ──────────────────────────────────────────────────
    "calm": {
        "concept": "garden-of-peace",
        "prompt_template": "Visualize [DROPDOWN] as a quiet garden with a still pond reflecting the sky.",
    },
    "contentment": {
        "concept": "garden-of-peace",
        "prompt_template": "Visualize [DROPDOWN] as a quiet garden with a still pond reflecting the sky.",
    },
    "acceptance": {
        "concept": "garden-of-peace",
        "prompt_template": "Visualize [DROPDOWN] as a quiet garden with a still pond reflecting the sky.",
    },
    "stillness": {
        "concept": "garden-of-peace",
        "prompt_template": "Visualize [DROPDOWN] as a quiet garden with a still pond reflecting the sky.",
    },

    # ── Rising from Ashes ────────────────────────────────────────────────
    "transformation": {
        "concept": "rising-from-ashes",
        "prompt_template": "Show [DROPDOWN] as a phoenix rising from embers into a bright sky.",
    },
    "recovery": {
        "concept": "rising-from-ashes",
        "prompt_template": "Show [DROPDOWN] as a phoenix rising from embers into a bright sky.",
    },
    "renewal": {
        "concept": "rising-from-ashes",
        "prompt_template": "Show [DROPDOWN] as a phoenix rising from embers into a bright sky.",
    },
    "second chance": {
        "concept": "rising-from-ashes",
        "prompt_template": "Show [DROPDOWN] as a phoenix rising from embers into a bright sky.",
    },
}
