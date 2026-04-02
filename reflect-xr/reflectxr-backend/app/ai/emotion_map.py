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

    # ── TODO: Add mappings for Aahil's 11 extended concepts ─────────────
    # "resilience":    { "concept": "resilience", ... },
    # "confusion":     { "concept": "crossroads", ... },
    # "nostalgia":     { "concept": "journey", ... },
    # etc.
}
