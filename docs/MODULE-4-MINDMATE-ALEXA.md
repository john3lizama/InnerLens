# Module 4 — MindMate Chat + Alexa/Echo Integration

**Owners:** Aahil (AI logic) + John (API + Alexa infra)
**Location:** `reflectxr-backend/app/routers/chat.py`, `app/services/chat_service.py`, `app/routers/alexa.py`

---

## Status

| Feature | Status |
|---------|--------|
| MindMate chat backend (`/chat`) | ✅ Complete |
| Emotion extraction + auto-generation trigger | ✅ Complete |
| Crisis detection + 988 fallback | ✅ Complete |
| Alexa webhook endpoint (`/alexa/webhook`) | ✅ Complete |
| Alexa Skill created in Developer Console | ✅ Complete |
| ngrok tunnel for local testing | ✅ Active |
| Interaction model (FreeFormIntent + EmotionIntent) | ✅ Built — 200+ utterances |
| End-to-end voice → GPT-4o-mini response | ✅ Working (switched from gpt-4o) |
| Session continuity within a conversation | ✅ Working (session_id via sessionAttributes) |
| Session memory across invocations | ✅ Working (previous_session_id loaded on LaunchRequest) |
| Image generation from voice conversation | ✅ Working (background task, fires after 5 messages) |
| Per-topic image isolation (no intertwining) | ✅ Working (new session per invocation) |
| MindMate correction handling | ✅ Improved via system prompt |
| MindMate advice mode | ✅ Implemented via system prompt |
| Mobile frontend wired to `/chat` | ❌ Not started (`USE_MOCK = true`) |

---

## 1. Environment Variables

These are set in `reflectxr-backend/.env`:

```env
# OpenAI — used for GPT-4o (MindMate chat) and emotion extraction
OPENAI_API_KEY=sk-proj-...

# Alexa Skill ID — validated on every incoming webhook request
AMAZON_SKILL_ID=amzn1.ask.skill.23e5b7eb-57aa-41b0-88d5-0ca5a99dcbe7

# Fixed UUID for the Alexa demo user in the DB (no OAuth needed)
ALEXA_DEMO_USER_ID=00000000-0000-0000-0000-000000000001
```

---

## 2. MindMate: How the Pieces Connect

MindMate is NOT a separate service. It uses the same backend — specifically the `/chat` router calling into `chat_service`, `emotion_service`, `prompt_builder`, and `image_service`.

### Data Flow

```
Mobile app sends:  POST /chat { session_id: null, message: "I've been stressed about school" }
                                    │
                                    ▼
chat.py (router)
  1. If session_id is null → create new Session(source="chat", user_id=current_user.id)
  2. Save user message to messages table
  3. Call safety.check_crisis(message)
     → If crisis: return immediately with is_crisis=true + 988 message
     → If safe: continue
  4. Load last 10 messages from DB, build context for GPT-4o
  5. Call GPT-4o → get empathetic reply
  6. Call emotion_service.extract_emotions(conversation text)
     → Returns [{"emotion": "stress", "intensity": 0.8}, ...]
     → Save emotion_tags JSONB on the assistant message
  7. Determine should_generate_image:
     → session has 3+ user messages
     → dominant emotion intensity >= 0.7
     → no image already generated for this session
  8. Return response to mobile app
                                    │
                                    ▼
Mobile app receives: { session_id: "abc", reply: "That sounds heavy...", emotion_tags: [...],
                       mode_detected: "check-in", should_generate_image: false, is_crisis: false }

... (conversation continues for 2 more turns) ...

Mobile app receives: { ..., should_generate_image: true, ... }
                                    │
                                    ▼
Mobile app sends:  POST /chat/generate-from-conversation { session_id: "abc" }
                                    │
                                    ▼
  → Extracts emotions from full conversation
  → Builds image prompt via prompt_builder
  → Generates 1 image (DALL-E 3), uploads to S3
  → Returns image URL + emotion summary
                                    │
                                    ▼
Mobile app shows ChatImageReveal modal with generated artwork
```

---

## 3. Alexa Integration

### Architecture

```
User speaks to Echo → Alexa Service → POST /alexa/webhook (FastAPI) → chat_service → GPT-4o → Alexa speaks reply
```

No Lambda function is used. The FastAPI backend handles Alexa requests directly.

### What's Built

**File:** `reflectxr-backend/app/routers/alexa.py`

**Endpoint:** `POST /alexa/webhook`

**Handles these request types:**

| Request Type | Behaviour |
|-------------|-----------|
| `LaunchRequest` | Checks DB for most recent session. Says "Welcome back" if one exists and stores `previous_session_id` in sessionAttributes for memory recall. |
| `IntentRequest → FreeFormIntent` | Proxies speech text to `chat_service`, speaks reply |
| `IntentRequest → EmotionIntent` | Captures single-word/short emotional responses (sad, overwhelmed, etc.) via custom slot type |
| `IntentRequest → AMAZON.FallbackIntent` | Routes to MindMate if any speech was captured; otherwise prompts gently |
| `IntentRequest → AMAZON.HelpIntent` | Explains how to use the skill |
| `IntentRequest → AMAZON.StopIntent / CancelIntent` | "Take care of yourself. Goodbye." |
| `SessionEndedRequest` | Silent — no response body needed |
| Unknown Skill ID | Returns HTTP 403 |

**Security:** Every request validates `applicationId` against `AMAZON_SKILL_ID` in `.env`. Mismatches return 403.

**Auth:** Uses a fixed demo user (`ALEXA_DEMO_USER_ID = 00000000-0000-0000-0000-000000000001`) seeded automatically in the DB. No OAuth or account linking needed.

**Session memory across invocations:**
- On `LaunchRequest`, the backend queries the DB for the demo user's most recent session
- If messages exist, `previous_session_id` is stored in Alexa `sessionAttributes`
- That ID is carried forward on every turn via `_handle_user_speech`
- When the user asks "do you remember our last conversation", the backend loads the previous session transcript and injects it into the GPT context as a system message
- Each new invocation creates a fresh session (no `session_id` in launch response) — images never mix between conversations

**Image generation:**
- Triggers after 5 user messages in a session, once per session
- Runs in a background `asyncio.create_task` — never blocks the Alexa response
- Each new "open Mind Mate" invocation = new session = independent image
- When triggered, Alexa speaks: "I'm creating some artwork based on our conversation. Open InnerLens on your phone in a moment to see it."

**quick=True mode (Alexa-specific):**
- Skips synchronous emotion extraction (saves ~2s per turn)
- Emotion extraction and image generation run in a background task after the response is sent
- Image trigger uses message count only (no emotion intensity check) since emotions aren't available yet

**Auto-art notification:** When `should_generate_image` is true, Alexa appends:
> "I'm creating some artwork based on our conversation. Open InnerLens on your phone in a moment to see it."

**Error handling:** If GPT is unavailable, Alexa speaks a graceful error instead of crashing:
> "I'm having trouble connecting right now. Please try again in a moment."

### Alexa Developer Console Setup

- **Skill ID:** `amzn1.ask.skill.23e5b7eb-57aa-41b0-88d5-0ca5a99dcbe7`
- **Endpoint type:** HTTPS
- **Default Region URL:** `https://<ngrok-url>/alexa/webhook`
- **Certificate type:** My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority
- **Invocation name:** `mind mate` (or `inner lens`)

### Interaction Model

Two custom intents + built-ins:

**Intent: `FreeFormIntent`** — open-ended speech via `AMAZON.SearchQuery`

| Slot | Type |
|------|------|
| `message` | `AMAZON.SearchQuery` |

200+ carrier phrase utterances covering:
- Emotional statements: `I feel {message}`, `I've been {message}`, `I'm {message}`
- Subject-first: `college is {message}`, `work and school {message}`, `money is {message}`
- Gerund answers: `having to {message}`, `trying to {message}`, `finding {message}`
- Elaborations: `because {message}`, `on top of that {message}`, `especially {message}`
- Questions: `what is {message}`, `how do I {message}`, `do you have {message}`
- Corrections: `no like {message}`, `what I mean is {message}`, `actually {message}`
- Memory: `do you remember {message}`, `do you {message}`

**Intent: `EmotionIntent`** — single-word/short emotional responses via custom slot

| Slot | Type |
|------|------|
| `emotion` | `EMOTION_TYPE` (custom enum) |

Captures bare words without carrier phrases — e.g. "sad", "overwhelmed", "not okay".
`EMOTION_TYPE` has 80+ values including emotions, advice-seeking phrases ("any suggestions", "help me", "I don't know"), and intensity modifiers ("really stressed", "super overwhelmed").

Both intents route through the same `_extract_speech()` → `_handle_user_speech()` code path.

Built-in intents enabled: `AMAZON.StopIntent`, `AMAZON.CancelIntent`, `AMAZON.HelpIntent`, `AMAZON.FallbackIntent`

### Local Testing with ngrok

```bash
# 1. Start the backend (if not already running)
cd reflect-xr/reflectxr-backend
docker-compose up -d

# 2. Start ngrok in a separate terminal
ngrok http 8000

# 3. Copy the https:// URL from ngrok output, e.g.:
#    https://trapezoid-goliath-botch.ngrok-free.dev

# 4. Set endpoint in Alexa Developer Console:
#    https://trapezoid-goliath-botch.ngrok-free.dev/alexa/webhook

# 5. Test the LaunchRequest manually:
curl -X POST https://trapezoid-goliath-botch.ngrok-free.dev/alexa/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "application": {"applicationId": "amzn1.ask.skill.23e5b7eb-57aa-41b0-88d5-0ca5a99dcbe7"},
      "attributes": {}
    },
    "request": {"type": "LaunchRequest"}
  }'
```

---

## 4. What's Still Needed

### To complete the mobile MindMate feature
- [ ] Set `USE_MOCK = false` in `src/hooks/useChat.ts`
- [ ] Remove mock responses and wire `chatService.sendMessage()` to `POST /chat`
- [ ] Wire `POST /chat/generate-from-conversation` when `should_generate_image` is true
- [ ] Show `ChatImageReveal` modal with returned image URL
- [ ] Display images generated from Alexa sessions (saved under `alexa-demo@innerlens.internal`)

### For production (post-demo)
- [ ] Replace ngrok with a real deployed URL (AWS/Render/Railway)
- [ ] Consider Alexa account linking (OAuth) so each voice user maps to their own account
- [ ] Add HTTPS signature verification for Alexa requests (required for certification)
- [ ] Add "start fresh" / "new conversation" intent so users can explicitly reset session memory

---

## 5. What Was Intentionally NOT Built

- No separate Alexa backend — the same FastAPI `/chat` endpoint handles everything
- No AWS Lambda — FastAPI serves the webhook directly
- No image display on Echo Show — Alexa speaks "check your phone" instead
- No OAuth/account linking — hardcoded demo user is sufficient for a demo
