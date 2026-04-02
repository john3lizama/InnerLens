"""
prompt_builder.py — Converts emotions into image generation prompts.

Used by MindMate's auto-generation flow:
1. Chat extracts emotions: [{"emotion": "anxiety", "intensity": 0.8}]
2. This module maps the dominant emotion to a concept template
3. Fills in the template and picks an appropriate art style
4. Returns (prompt, style) ready for DALL-E

The emotion-to-concept mapping lives in app/ai/emotion_map.py
"""

from app.ai.emotion_map import EMOTION_TO_CONCEPT, DEFAULT_CONCEPT


async def build_prompt_from_emotions(emotions: list[dict]) -> tuple[str, str]:
    """
    Takes extracted emotion tags, returns (assembled_prompt, suggested_style).

    Example:
        Input:  [{"emotion": "worry", "intensity": 0.8}]
        Output: ("Create waves of worry that rise and gently fade...", "Abstract / Expressionist")
    """
    if not emotions:
        # Fallback if no emotions were extracted
        return DEFAULT_CONCEPT["prompt_template"], "Watercolor"

    # Find the strongest emotion
    dominant = max(emotions, key=lambda e: e["intensity"])
    emotion_word = dominant["emotion"]

    # Look up the best concept template for this emotion
    concept = EMOTION_TO_CONCEPT.get(emotion_word, DEFAULT_CONCEPT)

    # Fill in the [DROPDOWN] placeholder with the actual emotion word
    prompt = concept["prompt_template"].replace("[DROPDOWN]", emotion_word)

    # Pick art style based on emotional intensity:
    # Strong emotions  -> bold, expressive style
    # Medium emotions  -> soft, fluid style
    # Subtle emotions  -> clean, minimal style
    if dominant["intensity"] > 0.8:
        style = "Abstract / Expressionist"
    elif dominant["intensity"] > 0.5:
        style = "Watercolor"
    else:
        style = "Minimalist"

    return prompt, style
