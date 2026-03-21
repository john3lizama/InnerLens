CRISIS_KEYWORDS = [
    "hurt myself", "kill myself", "don't want to live",
    "end my life", "want to die", "suicide",
    "self harm", "self-harm", "cut myself",
    "end it all", "no reason to live",
]

CRISIS_RESPONSE = (
    "I'm really sorry you're going through this. "
    "I'm not able to provide the help you need right now. "
    "Please call or text 988 if you're in the U.S., "
    "or contact local emergency services or someone nearby right away. "
    "You matter, and there are people who can help."
)

def check_crisis(text: str) -> str | None:
    """Returns crisis response if keywords detected, else None."""
    lowered = text.lower()
    for keyword in CRISIS_KEYWORDS:
        if keyword in lowered:
            return CRISIS_RESPONSE
    return None
