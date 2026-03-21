# Module 3 — AI Services (LLM + Image Generation)

**Owner:** Aahil
**Location:** `reflect-xr/reflectxr-backend/app/ai/` and `app/services/`

---

## 1. Your Three Systems

You own three distinct AI pipelines. They are separate modules but connect through the service layer.

```
1. IMAGE GENERATION     prompt string → DALL-E 3 / Stability → image bytes → S3 URL
2. CHAT ENGINE          user message + history → GPT-4o → empathetic reply
3. EMOTION EXTRACTION   conversation text → GPT-4o → JSON emotion tags
```

---

## 2. Image Generation (`app/services/image_service.py`)

This is called from two places:
- `POST /generate` (user explicitly submits a prompt from the Concept→Prompt Design flow)
- `POST /chat/generate-from-conversation` (auto-triggered by MindMate when emotions are strong enough)

### Implementation

```python
import httpx
from openai import AsyncOpenAI
from app.config import settings
from app.utils.storage import upload_image

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def generate_images(prompt: str, style: str, count: int = 4) -> list[dict]:
    """Generate N images from a prompt+style. Returns list of {image_bytes, revised_prompt}."""
    full_prompt = f"{prompt} Style: {style}."
    results = []
    for _ in range(count):
        response = await client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            size="1024x1024",
            quality="standard",
            n=1,  # DALL-E 3 only supports n=1
        )
        image_url = response.data[0].url
        # Download the image bytes
        async with httpx.AsyncClient() as http:
            img_response = await http.get(image_url)
            results.append({
                "image_bytes": img_response.content,
                "revised_prompt": response.data[0].revised_prompt,
            })
    return results
```

### Key Points
- DALL-E 3 only generates 1 image per call (unlike DALL-E 2). To get 4 images, make 4 calls.
- This costs ~$0.04 per image ($0.16 per set of 4). Budget accordingly.
- The `revised_prompt` from OpenAI is what DALL-E actually used — store this in `prompt_used`.
- If switching to Stability AI, create a separate `stability_client.py` and a factory pattern.

### Rate Limiting
- DALL-E 3: 7 images per minute on free tier, 50/min on paid
- Add retry logic with exponential backoff for 429 responses
- Consider generating 2 images instead of 4 during development to save costs

---

## 3. Chat Engine (`app/services/chat_service.py`)

### System Prompt Design
The MindMate system prompt is in `app/ai/system_prompts.py`. It already defines three modes (check-in, grounding, reflection). Your job is to:

1. **Test it extensively.** Run 20+ sample conversations in the OpenAI playground before integrating.
2. **Tune the tone.** It must feel warm but not saccharine. Responses must be 2-4 sentences max.
3. **Never claim to be a therapist.** The prompt must explicitly prevent this.
4. **Mode detection.** After the LLM responds, classify which mode the conversation is in (check-in, grounding, reflection) based on the content. This helps the frontend display appropriate UI.

### Context Window Management
Store messages in the `messages` table. When building the LLM context:

```python
async def build_context(session_id: uuid, new_message: str) -> list[dict]:
    # Get last 5 message pairs (10 messages) from DB
    recent_messages = await get_recent_messages(session_id, limit=10)

    context = [{"role": "system", "content": MINDMATE_SYSTEM_PROMPT}]
    for msg in recent_messages:
        context.append({"role": msg.role, "content": msg.content})
    context.append({"role": "user", "content": new_message})
    return context
```

5 turns of history is enough for continuity without hitting token limits. GPT-4o has a 128k context window so this is never an issue, but keeping it small keeps costs down.

### Auto-Generation Trigger
After emotion extraction, check if:
1. The session has 3+ user messages (enough conversation to understand emotions)
2. A dominant emotion has intensity >= 0.7
3. The session hasn't already generated an image

If all true, set `should_generate_image=true` in the response. The frontend then calls `/chat/generate-from-conversation`.

---

## 4. Emotion Extraction (`app/services/emotion_service.py`)

### How It Works
After every chat exchange, make a secondary GPT call using the `EMOTION_EXTRACTION_PROMPT` from `system_prompts.py`. Pass the last 3-5 conversation turns.

```python
async def extract_emotions(conversation_text: str) -> list[dict]:
    response = await client.chat.completions.create(
        model="gpt-4o-mini",  # Use mini for extraction — cheaper, fast enough
        messages=[
            {"role": "system", "content": EMOTION_EXTRACTION_PROMPT},
            {"role": "user", "content": conversation_text},
        ],
        temperature=0.3,  # Low temperature for consistent structured output
    )
    # Parse JSON from response
    import json
    return json.loads(response.choices[0].message.content)
```

### Key Points
- Use `gpt-4o-mini` for extraction (not full gpt-4o) — it's 15x cheaper and accurate enough for emotion classification
- Set `temperature=0.3` for consistent, structured output
- Validate the JSON response — if parsing fails, return an empty list (don't crash)
- Store emotion tags as JSONB on the `messages` table AND on `journal_entries`

### Also Used On Journal Entries
When a user saves a journal entry via `POST /journal`, the backend runs emotion extraction on the journal text and stores the tags. This satisfies requirement R5 (emotional tagging / NLP).

---

## 5. Prompt Builder (`app/services/prompt_builder.py`)

This module converts extracted emotions into image generation prompts. Used by MindMate's auto-generation flow.

```python
from app.ai.emotion_map import EMOTION_TO_CONCEPT

async def build_prompt_from_emotions(emotions: list[dict]) -> tuple[str, str]:
    """Takes emotion tags, returns (assembled_prompt, suggested_style)."""
    dominant = max(emotions, key=lambda e: e["intensity"])
    emotion_word = dominant["emotion"]

    # Find best matching concept template
    concept = EMOTION_TO_CONCEPT.get(emotion_word, DEFAULT_CONCEPT)

    # Assemble the prompt by filling in the template
    prompt = concept["prompt_template"].replace("[DROPDOWN]", emotion_word)

    # Select style based on emotion intensity
    if dominant["intensity"] > 0.8:
        style = "Abstract / Expressionist"  # Strong emotions → bold style
    elif dominant["intensity"] > 0.5:
        style = "Watercolor"  # Medium → soft style
    else:
        style = "Minimalist"  # Subtle → clean style

    return prompt, style
```

### Emotion Map (`app/ai/emotion_map.py`)
Build a lookup table mapping emotion keywords to the closest concept from the brief:

```python
EMOTION_TO_CONCEPT = {
    "worry": {"concept": "emotional-waves", "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water."},
    "anxiety": {"concept": "emotional-waves", "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water."},
    "loneliness": {"concept": "a-safe-space", "prompt_template": "Visualize [DROPDOWN] as a space — vast, empty, or waiting."},
    "grief": {"concept": "a-safe-space", "prompt_template": "Visualize [DROPDOWN] as a space — vast, empty, or waiting."},
    "hope": {"concept": "bright-horizon", "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon."},
    "joy": {"concept": "bright-horizon", "prompt_template": "Show [DROPDOWN] as a bright sun emerging over the horizon."},
    "gratitude": {"concept": "inner-garden", "prompt_template": "Illustrate [DROPDOWN] as a colorful garden that grows when tended."},
    # ... map all emotions from every concept's dropdown list
}
```

---

## 6. Safety Module (`app/ai/safety.py`)

Already implemented. Review:
- Crisis keywords trigger an immediate 988 response — NO LLM call is made
- The check runs BEFORE the LLM call (fail-fast)
- When crisis is detected, response has `is_crisis=true` so the frontend can show special UI
- Consider adding more keywords after user testing reveals edge cases

---

## 7. Testing Your AI Modules

Create `tests/test_ai.py`:

```python
# Test crisis detection
def test_crisis_detection():
    from app.ai.safety import check_crisis
    assert check_crisis("I want to hurt myself") is not None
    assert check_crisis("I had a bad day") is None

# Test emotion extraction (mock the OpenAI call)
async def test_emotion_extraction():
    # Mock GPT response with known JSON
    result = await extract_emotions("I've been really anxious about finals")
    assert len(result) > 0
    assert result[0]["emotion"] in ["anxiety", "stress", "worry"]
    assert 0 <= result[0]["intensity"] <= 1.0

# Test prompt builder
async def test_prompt_builder():
    emotions = [{"emotion": "worry", "intensity": 0.8}]
    prompt, style = await build_prompt_from_emotions(emotions)
    assert "worry" in prompt
    assert style != ""
```

### Manual Testing Checklist
- [ ] MindMate responds warmly to "I'm feeling down today"
- [ ] MindMate guides a breathing exercise when asked "I need to calm down"
- [ ] Crisis message appears for "I want to hurt myself" (no LLM call)
- [ ] Emotion extraction returns valid JSON for 10 different conversation samples
- [ ] Prompt builder generates a sensible image prompt from extracted emotions
- [ ] Generated images actually reflect the emotional theme
- [ ] System works with empty/short messages without crashing

---

## 8. Cost Management

| API Call | Model | Cost | When Used |
|----------|-------|------|-----------|
| Chat response | gpt-4o | ~$0.005/call | Every chat message |
| Emotion extraction | gpt-4o-mini | ~$0.0003/call | Every chat message + journal save |
| Image generation | dall-e-3 (standard) | ~$0.04/image | Concept flow (4 images) + chat auto-gen (1 image) |

**Per user session estimate:** ~$0.20 for a concept flow + reflection, ~$0.10 for a MindMate conversation with auto-generation.

**Development tip:** Use `gpt-4o-mini` for chat during development to save money. Switch to `gpt-4o` for the demo.
