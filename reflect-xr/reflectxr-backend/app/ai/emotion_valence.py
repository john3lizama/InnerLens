"""
emotion_valence.py — Maps each emotion keyword to a valence score.

Valence drives the direction of the mood graph on Home: positive emotions
render above the mid-line, negative below. A small group of genuinely
mixed-signal words stays at 0 so they don't muddy the signal either way.

The emotion classifier (see `EMOTION_EXTRACTION_PROMPT` in
`app/ai/system_prompts.py`) is **not** vocabulary-restricted — GPT can
return any noun-form emotion it wants. So on top of the explicit table we
ship a substring-heuristic fallback in `valence_of()`. The explicit table
covers the vocabulary shared with `emotion_map.py` plus the common
English feeling words we see in production; the heuristic picks up the
long tail (compound forms, rare synonyms, morphology) so the graph still
reads as up/down instead of everything floating on the midline.

Ordering in `valence_of()`:
  1. Exact lookup (fast path, authoritative).
  2. Negative cues, checked before positive — "hopeless" must beat "hope",
     "unhappy" must beat "happy".
  3. Positive cues.
  4. Fallback to 0.
"""

# -1 / 0 / +1
EMOTION_VALENCE: dict[str, int] = {
    # ── Positive (+1) ────────────────────────────────────────────────────
    # Concept-map vocabulary (kept in sync with emotion_map.EMOTION_TO_CONCEPT).
    "hope": 1,
    "joy": 1,
    "optimism": 1,
    "gratitude": 1,
    "peace": 1,
    "calm": 1,
    "contentment": 1,
    "acceptance": 1,
    "stillness": 1,
    "courage": 1,
    "determination": 1,
    "adaptability": 1,
    "growth": 1,
    "discovery": 1,
    "opportunity": 1,
    "ambition": 1,
    "healing": 1,
    "confidence": 1,
    "clarity": 1,
    "trust": 1,
    "forgiveness": 1,
    "communication": 1,
    "understanding": 1,
    "loyalty": 1,
    "support": 1,
    "laughter": 1,
    "belonging": 1,
    "stability": 1,
    "identity": 1,
    "home": 1,
    "tradition": 1,
    "transformation": 1,
    "recovery": 1,
    "renewal": 1,
    "second chance": 1,

    # Common classifier output beyond the concept map — words GPT-4o-mini
    # actually returns in production for upbeat content.
    "happiness": 1,
    "love": 1,
    "excitement": 1,
    "anticipation": 1,
    "appreciation": 1,
    "comfort": 1,
    "relief": 1,
    "pride": 1,
    "satisfaction": 1,
    "inspiration": 1,
    "enthusiasm": 1,
    "compassion": 1,
    "empathy": 1,
    "awe": 1,
    "wonder": 1,
    "admiration": 1,
    "amusement": 1,
    "bliss": 1,
    "delight": 1,
    "euphoria": 1,
    "serenity": 1,
    "tenderness": 1,
    "warmth": 1,
    "cheerfulness": 1,
    "affection": 1,
    "fondness": 1,
    "elation": 1,
    "accomplishment": 1,
    "fulfillment": 1,
    "curiosity": 1,
    "interest": 1,
    "motivation": 1,
    "encouragement": 1,
    "empowerment": 1,
    "validation": 1,
    "resilience": 1,
    "rediscovery": 1,
    "liberation": 1,
    "vindication": 1,

    # ── Negative (-1) ────────────────────────────────────────────────────
    # Concept-map vocabulary.
    "worry": -1,
    "anxiety": -1,
    "self-doubt": -1,
    "longing": -1,
    "loneliness": -1,
    "grief": -1,
    "isolation": -1,
    "stress": -1,
    "burnout": -1,
    "overwhelm": -1,
    "confusion": -1,
    "indecision": -1,
    "fear of change": -1,
    "pretending": -1,
    "hiding": -1,
    "performing": -1,
    "protecting": -1,
    "regret": -1,
    "control": -1,
    "perfectionism": -1,
    "resentment": -1,

    # Common classifier output.
    "sadness": -1,
    "anger": -1,
    "frustration": -1,
    "fear": -1,
    "shame": -1,
    "guilt": -1,
    "disappointment": -1,
    "disgust": -1,
    "embarrassment": -1,
    "envy": -1,
    "jealousy": -1,
    "annoyance": -1,
    "irritation": -1,
    "despair": -1,
    "melancholy": -1,
    "bitterness": -1,
    "dread": -1,
    "panic": -1,
    "hurt": -1,
    "pain": -1,
    "hopelessness": -1,
    "discouragement": -1,
    "self-hatred": -1,
    "self-criticism": -1,
    "insecurity": -1,
    "inadequacy": -1,
    "helplessness": -1,
    "defeat": -1,
    "exhaustion": -1,
    "weariness": -1,
    "apathy": -1,
    "numbness": -1,
    "doubt": -1,
    "powerlessness": -1,
    "restlessness": -1,
    "unease": -1,
    "pessimism": -1,
    "rejection": -1,
    "betrayal": -1,
    "humiliation": -1,
    "tension": -1,
    "heartbreak": -1,
    "vulnerability": -1,   # leans negative in therapeutic context
    "suffering": -1,
    "distress": -1,
    "hostility": -1,

    # ── Neutral / mixed (0) ──────────────────────────────────────────────
    # These carry real emotional weight but can skew either direction
    # depending on context. Keeping them at 0 avoids mislabeling the day.
    "change": 0,
    "nostalgia": 0,
    "surprise": 0,
    "ambivalence": 0,
    "reflection": 0,
    "contemplation": 0,
}


# Substring cues for the heuristic fallback. Checked *after* the exact
# lookup and *before* returning 0 so the mood graph still reads as
# directional for classifier outputs we haven't explicitly catalogued.
#
# Order matters within each tuple: longer / more-specific morphemes first
# so e.g. "hopeless" catches before "hope".
_NEGATIVE_CUES: tuple[str, ...] = (
    "hopeless", "loveless", "unhappy", "dissatisf", "discourag",
    "self-hat", "self-loath", "self-critic", "self-doubt",
    "sad", "angr", "anger", "frustrat", "anxi", "worr", "stress",
    "grief", "griev", "lone", "ashame", "shame", "guilt", "regret",
    "disappoint", "hate", "hostil", "hurt", "pain", "despair",
    "melan", "bitter", "dread", "panic", "resent", "jealou", "envy",
    "insecur", "inadequ", "helpless", "powerless", "overwhelm",
    "burnout", "defeat", "exhaust", "weary", "weariness", "apath",
    "numb", "confus", "unease", "restless", "pessim", "scar",
    "embarr", "reject", "betray", "humiliat", "tense", "tension",
    "annoy", "irritat", "agit", "afraid", "fear", "phobi",
    "distress", "torment", "misery", "miserab", "sorrow", "heartbreak",
    "crush", "broken", "inferior", "worthless", "useless", "trapped",
    "stuck", "suffocat", "drain", "hollow", "empty", "alienat",
    "disconnect", "abandon", "neglect", "unwanted", "unloved",
    "mourning",
)

_POSITIVE_CUES: tuple[str, ...] = (
    "happ", "joy", "love", "hope", "pride", "proud", "relief",
    "grat", "excit", "enthusias", "confid", "inspir", "appreci",
    "compass", "empath", "warm", "cheer", "content", "peace",
    "calm", "comfort", "deligh", "serene", "serenit", "tender",
    "amus", "satisf", "accompl", "fulfill", "bliss", "optim",
    "heal", "renew", "trust", "curiou", "wonder", "awe", "admir",
    "encourag", "empower", "motivat", "celebrat", "safe", "secure",
    "belong", "support", "connect", "affection", "fondness",
    "cherish", "elat", "euphor", "rediscover", "validat",
    "liberat", "vindicat", "courage", "determin", "adapt",
    "growth", "discover", "opportun", "ambiti", "clarit",
    "forgiv", "communicat", "underst", "loyal", "laugh",
    "stabilit", "identit", "tradition", "transform", "recover",
    "renewal", "accept",
)


def valence_of(emotion: str) -> int:
    """Valence in {-1, 0, +1} for an emotion keyword.

    Strategy:
      1. Exact lookup in EMOTION_VALENCE.
      2. Negative substring cues (before positive — "hopeless" beats "hope").
      3. Positive substring cues.
      4. Default 0.
    """
    if not emotion:
        return 0
    key = emotion.strip().lower()
    if not key:
        return 0
    if key in EMOTION_VALENCE:
        return EMOTION_VALENCE[key]
    for cue in _NEGATIVE_CUES:
        if cue in key:
            return -1
    for cue in _POSITIVE_CUES:
        if cue in key:
            return 1
    return 0
