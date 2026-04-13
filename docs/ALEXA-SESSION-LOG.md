# Alexa Integration — Session Log & Debugging Record

**Date:** 2026-04-11
**Engineer:** John
**Session goal:** Get Amazon Echo talking to MindMate (GPT-4o), saving chat logs, and generating images from voice conversations.

---

## System State Before This Session

| Component | State |
|-----------|-------|
| Alexa webhook (`/alexa/webhook`) | Built, untested end-to-end |
| Alexa skill in Developer Console | Created, interaction model built |
| OpenAI API | Blocked — billing limit reached |
| Docker compose | Running locally |
| ngrok tunnel | Active (`trapezoid-goliath-botch.ngrok-free.dev`) |
| GPT model in chat_service | `gpt-4o` |
| OpenAI client timeout | Default (600s — no timeout set) |
| Pydantic extra fields | `extra="forbid"` — crashing on unknown `.env` keys |

---

## Issues Found & Fixed

---

### Issue 1: OpenAI billing limit
**Symptom:** All chat calls returned 500 / graceful Alexa error.
**Root cause:** OpenAI account had no credits — API was rejecting calls.
**Fix:** Added $30 credit limit to the OpenAI account.
**Verified:** `curl https://api.openai.com/v1/chat/completions` with the project key returned a valid response.

---

### Issue 2: Server frozen by hanging OpenAI request (no timeout)
**Symptom:** After one chat request, `curl http://localhost:8000/health` timed out. The entire uvicorn event loop was blocked.
**Root cause:** The OpenAI Python library defaults to a 600-second timeout. Inside Docker, the first outbound HTTPS connection to `api.openai.com` stalled (not failed — stalled), holding the async handler open and blocking uvicorn from accepting any new connections.
**Fix:** Added `timeout=30.0` to all three `AsyncOpenAI` client instantiations:
- `app/services/chat_service.py`
- `app/services/emotion_service.py`
- `app/ai/safety.py`

**Verified:** After Docker restart, `curl /health` returned immediately. Chat requests completed in ~3 seconds.

---

### Issue 3: Docker Desktop stuck mid-update (containers frozen)
**Symptom:** `docker compose restart api` hung indefinitely. All three containers (api, db, nginx) showed a loading spinner in Docker Desktop. `docker compose kill api` also hung.
**Root cause:** Docker Desktop version 4.68.0 update was pending and had partially applied, leaving the daemon in a broken state.
**Fix:**
```bash
killall -9 "Docker Desktop" 2>/dev/null
killall -9 "com.docker.backend" 2>/dev/null
open -a Docker
# Wait for whale icon to stop animating
cd reflect-xr/reflectxr-backend
docker compose up -d
```
**Verified:** All three containers came up healthy. `docker compose ps` showed all green.

---

### Issue 4: `pydantic_settings` rejecting `ngrok_authtoken` in `.env`
**Symptom:** API container started but immediately crashed with:
```
pydantic_core.ValidationError: 1 validation error for Settings
ngrok_authtoken — Extra inputs are not permitted
```
**Root cause:** `.env` contains `ngrok_authtoken=...` which is not declared in `app/config.py`. Pydantic's default `extra="forbid"` mode rejects unknown fields.
**Fix:** Changed `model_config` in `app/config.py`:
```python
# Before
model_config = SettingsConfigDict(env_file=".env")

# After
model_config = SettingsConfigDict(env_file=".env", extra="ignore")
```
**Verified:** API container started successfully. `/health` returned `{"status":"ok"}`.

---

### Issue 5: Pylance import errors in VSCode (`fastapi`, `sqlalchemy` not resolved)
**Symptom:** VSCode showed red underlines on all imports. Pylance reported `reportMissingImports` for `fastapi`, `sqlalchemy.ext.asyncio`, etc.
**Root cause:** The project runs inside Docker. No local Python virtual environment existed for Pylance to resolve packages against. System Python 3.13 doesn't have any of the project dependencies installed.
**Fix:**
```bash
cd reflect-xr/reflectxr-backend
python3 -m venv .venv
.venv/bin/pip install fastapi "sqlalchemy[asyncio]" asyncpg pydantic-settings openai httpx boto3 Pillow passlib python-jose uvicorn
```
Then created `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python",
  "python.analysis.extraPaths": ["${workspaceFolder}"]
}
```
Then: Command Palette → **Python: Select Interpreter** → chose `.venv/bin/python`.
**Verified:** Import errors cleared after Pylance reindexed.

---

### Issue 6: Alexa returning "I'm not quite sure how to help you with that"
**Symptom:** Saying "Alexa, open mind mate" returned the generic Alexa error — skill not found.
**Root cause (identified progressively):**
1. First: endpoint URL in Developer Console was missing `/alexa/webhook` — was just the base ngrok URL.
2. After fixing URL: requests were hitting `/` (404) because the path was wrong.
3. After fixing path: `INVALID_RESPONSE` error — backend was crashing on startup (Issue 4 above).
4. After fixing crash: skill worked in simulator but not on Echo — Echo was on a different Amazon account than the developer console login.

**Fixes applied:**
- Set Default Region endpoint to `https://trapezoid-goliath-botch.ngrok-free.dev/alexa/webhook`
- Selected SSL certificate type: **"My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority"**
- Logged Alexa app on phone out and back in with the same Amazon account used in developer.amazon.com
- Rebuilt interaction model after each change

**Verified:** ngrok inspector showed requests hitting `/alexa/webhook` with 200 responses. Alexa simulator returned "Welcome to InnerLens Mind Mate..." Physical Echo also responded after account fix.

---

### Issue 7: Alexa not capturing speech — "I didn't quite catch that" loop
**Symptom:** After launch, anything said to the Echo triggered "I didn't quite catch that" repeatedly. MindMate never received the spoken text.
**Root cause:** `AMAZON.SearchQuery` slot type is unreliable for open-ended conversational speech. When the utterance didn't match a carrier phrase pattern exactly, Alexa fired `AMAZON.FallbackIntent` instead of `FreeFormIntent` — and `FallbackIntent` had no slot to capture the spoken text.
**Fixes applied:**
1. Added `AMAZON.FallbackIntent` handling in `alexa.py` — routes to MindMate the same as `FreeFormIntent`.
2. Added `_extract_speech()` helper that reads slot values from any slot name (message, query, utterance, etc.).
3. Collapsed all intent handling into a single code path — any intent with captured speech goes to MindMate.
4. Expanded interaction model utterances to 20+ carrier phrases covering natural speech patterns.
5. Added `AMAZON.FallbackIntent` to the interaction model JSON.

**Interaction model JSON applied (via JSON Editor in Developer Console):**
```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "mind mate",
      "intents": [
        {"name": "AMAZON.CancelIntent", "samples": []},
        {"name": "AMAZON.HelpIntent", "samples": []},
        {"name": "AMAZON.StopIntent", "samples": []},
        {"name": "AMAZON.NavigateHomeIntent", "samples": []},
        {"name": "AMAZON.FallbackIntent", "samples": []},
        {
          "name": "FreeFormIntent",
          "slots": [{"name": "message", "type": "AMAZON.SearchQuery"}],
          "samples": [
            "I feel {message}",
            "I am feeling {message}",
            "I have been feeling {message}",
            "I feel really {message}",
            "I have been {message}",
            "I am {message}",
            "I feel so {message}",
            "I've been feeling {message}",
            "I want to talk about {message}",
            "I've been really {message}",
            "tell mindmate {message}",
            "I feel like {message}",
            "I am really {message}",
            "feeling {message}",
            "I said {message}",
            "my answer is {message}",
            "I think {message}",
            "it's been {message}",
            "things have been {message}",
            "lately I feel {message}",
            "honestly {message}"
          ]
        }
      ],
      "types": []
    }
  }
}
```

---

### Issue 8: Alexa session dropping mid-conversation
**Symptom:** After 1-2 exchanges, Alexa played a disconnect sound and stopped responding.
**Root cause:** Alexa enforces an **8-second response timeout**. `gpt-4o` responses were taking 5-8 seconds. Combined with database writes and emotion extraction, total latency occasionally exceeded 8 seconds, causing Alexa to kill the session.
**Fixes applied:**
1. Switched `chat_service.py` from `gpt-4o` to `gpt-4o-mini` (1-2s response vs 5-8s).
2. Reduced `max_tokens` from 300 to 150 (shorter responses = faster).
3. Added `_send_progressive_response()` to `alexa.py` — immediately sends "Hmm, let me think about that" via the Alexa Progressive Response API before the GPT call, keeping the session alive.

**Verified:** Test curl through ngrok returned in 3.1 seconds. Response was valid and empathetic.

---

### Issue 9: Image generation announced but not actually triggered
**Symptom:** Code said "I've created some artwork" but never called DALL-E.
**Root cause:** The original code only appended the text to the reply when `should_generate_image` was true, but never actually called `generate_from_conversation()`.
**Fix:** Added actual call to `generate_from_conversation()` inside `_handle_user_speech()` in `alexa.py`. Image is generated, stored in S3, and saved to the database before the response is returned to Alexa.

---

## What Is Currently Verified Working

| Test | Result |
|------|--------|
| `curl /health` | ✅ Returns `{"status":"ok"}` |
| `curl /alexa/webhook` LaunchRequest | ✅ Returns welcome speech |
| `curl /alexa/webhook` FreeFormIntent with slot value | ✅ Returns GPT-4o-mini reply in ~1s |
| 5-message simulation (all messages) | ✅ All complete in under 1.3s each |
| ngrok tunnel reaching backend | ✅ Confirmed via ngrok inspector |
| Echo saying "Alexa, open mind mate" | ✅ Skill launches |
| Echo sustaining long conversations (10+ turns) | ✅ No timeout after progressive response removed |
| Single-word emotional responses ("sad", "overwhelmed") | ✅ Via EmotionIntent + EMOTION_TYPE enum |
| Natural speech captured ("having to find a job") | ✅ Via expanded FreeFormIntent carrier phrases |
| Short answers to questions ("my personal life") | ✅ Via `my {message}` carrier phrase |
| Question-form inputs ("what should I do") | ✅ Via `what should {message}` carrier phrases |
| Chat messages saved to DB | ✅ Via `handle_chat_message()` |
| Emotion tags extracted + saved | ✅ Via background task in `_background_work()` |
| Image generation after 5 messages | ✅ `generate_from_conversation()` in background task |
| Alexa speaks image notification | ✅ "Open InnerLens on your phone" |
| Per-topic image isolation | ✅ New session per invocation = separate images |
| Session memory across invocations | ✅ `previous_session_id` stored on LaunchRequest, loaded on "do you remember" |
| MindMate handles corrections gracefully | ✅ System prompt updated |
| MindMate gives advice when asked | ✅ System prompt ADVICE mode added |
| MindMate ends conversation gracefully | ✅ System prompt updated for natural endings |

---

## What Is Still Pending

| Item | Notes |
|------|-------|
| Mobile app wired to `/chat` | `USE_MOCK = true` in `src/hooks/useChat.ts` — needs to be flipped |
| Mobile shows images from Alexa session | Images are saved under `alexa-demo@innerlens.internal` user — mobile needs account linking to display them |
| "Start fresh" voice command | Users can't explicitly reset to a new session via voice yet |
| Production deployment | ngrok URL changes on restart. Need a stable URL (Railway/Render/AWS) |
| Alexa account linking | Currently all voice users share one demo user in the DB |
| Alexa HTTPS signature verification | Required for skill certification submission |

---

---

### Issue 10: Alexa session dropping after exactly 2 responses — progressive response was the cause
**Symptom:** Physical Echo consistently disconnected after the user sent 3 messages, having received only 2 replies. Simulator worked fine.
**Root cause:** `_send_progressive_response()` in `alexa.py` was `await`-ing an outbound HTTPS call to `api.amazonalexa.com/v1/directives` using the `VoicePlayer.Speak` directive before every GPT call. This directive is designed for AudioPlayer skills, not Custom Skills. Sending it inside a conversational session caused Alexa to accumulate bad state and terminate the session, consistently on the 3rd turn.
**Fix:** Removed `_send_progressive_response()` entirely. Also removed `httpx` import.
**Verified:** 5-message simulation completed in 0.8–1.3s per message. Physical Echo sustained 10+ turn conversations.

---

### Issue 11: Natural speech not captured — "college is making me stressed", "having to find a job"
**Symptom:** Phrases that don't start with "I feel/am/think" fell to FallbackIntent with no slot value. Backend returned "I'm here and I'm listening" repeatedly.
**Root cause:** `AMAZON.SearchQuery` requires a carrier phrase. Subject-first sentences ("college is..."), gerund answers ("having to..."), question-form inputs ("what should I do") had no matching carrier phrases.
**Fix:** Expanded `FreeFormIntent` to 200+ utterances. Added second intent `EmotionIntent` with custom `EMOTION_TYPE` enum slot that captures bare single-word responses without any carrier phrase.
**Key new patterns added:**
- `my {message}` — covers "my personal life", "my home life and money"
- `having to {message}` — covers "having to find a place to live"
- `money and {message}`, `work and {message}` — covers compound subjects
- `what is {message}`, `how do I {message}` — covers question-form inputs
- `because {message}`, `on top of that {message}` — covers elaboration continuations
- `EmotionIntent` with bare `{emotion}` — covers "sad", "overwhelmed", "help me"

---

### Issue 12: "finding a place {message}" carrier phrase bug — MindMate only received "to live"
**Symptom:** User said "finding a place to live". MindMate responded "Can you share more about what you mean by 'to live'?"
**Root cause:** The carrier phrase `finding a place {message}` consumed "finding a place" and only passed "to live" to the slot. MindMate had no context for the full phrase.
**Fix:** Removed `finding a place {message}` and `finding an apartment {message}` from the model. The existing `finding {message}` carrier phrase correctly captures "a place to live" as the full slot value.

---

### Issue 13: MindMate misinterpreting corrections and frustration
**Symptom:**
- User said "I didn't say I had a hectic day" → MindMate kept making the same misinterpretation
- User said "are you dumb" → MindMate responded as if user was calling themselves dumb
- User said "nah I'm good" (done talking) → MindMate kept asking another question
**Root cause:** System prompt had no explicit instructions for handling corrections, AI-directed frustration, or natural conversation endings.
**Fix:** Updated `MINDMATE_SYSTEM_PROMPT` in `app/ai/system_prompts.py` with explicit sections for:
- **HANDLING CORRECTIONS**: acknowledge immediately, never repeat the misread
- **HANDLING FRUSTRATION DIRECTED AT YOU**: recognise "are you dumb" as directed at the AI, not self-directed
- **HANDLING NATURAL CONVERSATION ENDINGS**: close warmly without asking another question
- **ADVICE MODE**: give concrete actionable steps when user asks "what should I do"

---

### Issue 14: No memory across invocations — "do you remember our last conversation" fell to fallback
**Symptom:** User opened Mind Mate a second time. Asked "do you remember our last conversation" — got fallback response. MindMate had no knowledge of the previous session.
**Root cause:**
1. "do you remember" had no matching carrier phrase → fell to FallbackIntent with no slot value
2. Alexa session attributes are ephemeral — they reset on every new invocation
3. LaunchRequest never loaded previous session data from the DB
**Fix — three parts:**
1. Added `do you remember {message}` and `do you {message}` to `FreeFormIntent` utterances
2. `LaunchRequest` handler now queries DB for the demo user's most recent session with messages. Stores its ID as `previous_session_id` in `sessionAttributes`. Returns "Welcome back" greeting.
3. `_handle_user_speech()` detects memory keywords in the user's text. If `previous_session_id` is present, loads that session's full message transcript from DB and injects it into the GPT call as a system-level context message via the new `extra_context` parameter on `handle_chat_message()`.
4. `previous_session_id` is carried forward on every turn via `sessionAttributes`, not just on the first message.
**Verified:** "do you remember our last conversation" now causes MindMate to recall and summarise the previous session accurately.

---

### Issue 15: Image generation threshold set to 8 (testing value — never fired)
**Symptom:** Images never generated during real conversations.
**Root cause:** Threshold had been raised to 8 during debugging to isolate the session dropout bug.
**Fix:** Reset to 5 in `chat_service.py` quick mode: `should_generate = user_msg_count >= 5 and not has_existing_image`

---

## Key File Locations

| File | What It Does |
|------|-------------|
| `app/routers/alexa.py` | Webhook handler — LaunchRequest memory loading, intent routing, memory question detection, image gen trigger |
| `app/services/chat_service.py` | MindMate chat engine — GPT-4o-mini, `quick` mode, `extra_context` injection, image trigger logic |
| `app/ai/system_prompts.py` | MindMate system prompt — correction handling, advice mode, ending detection, memory guidance |
| `app/services/emotion_service.py` | Extracts emotion tags from conversation text via GPT-4o-mini |
| `app/services/image_service.py` | DALL-E 3 image generation + S3 upload |
| `app/ai/safety.py` | Crisis keyword detection + OpenAI moderation |
| `app/config.py` | Pydantic settings — reads from `.env`, `extra="ignore"` so unknown keys don't crash |
| `app/db/database.py` | Async SQLAlchemy engine + session factory |
| `app/models/session.py` | Session model — used by LaunchRequest to find previous session |
| `app/models/message.py` | Message model — used to load previous session transcript for memory recall |
| `reflect-xr/reflectxr-backend/.vscode/settings.json` | Points VSCode Pylance to `.venv` interpreter |

---

## How to Start the Stack

```bash
# 1. Start Docker containers
cd reflect-xr/reflectxr-backend
docker compose up -d

# 2. Verify backend is healthy
curl http://localhost:8000/health

# 3. Start ngrok (in a separate terminal)
ngrok http 8000

# 4. Update endpoint in Alexa Developer Console if ngrok URL changed:
#    Build → Endpoint → https://<new-url>/alexa/webhook
#    Save Endpoints → Build Model

# 5. Test webhook directly
curl -s -X POST https://<ngrok-url>/alexa/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "application": {"applicationId": "amzn1.ask.skill.23e5b7eb-57aa-41b0-88d5-0ca5a99dcbe7"},
      "attributes": {}
    },
    "context": {
      "System": {
        "apiEndpoint": "https://api.amazonalexa.com",
        "apiAccessToken": "test"
      }
    },
    "request": {
      "type": "IntentRequest",
      "intent": {
        "name": "FreeFormIntent",
        "slots": {
          "message": {"name": "message", "value": "I feel stressed about school"}
        }
      }
    }
  }'
```

---

## ngrok Debugging

Check what Alexa is actually sending and what the backend responded:

```bash
# See last 10 requests
curl -s http://localhost:4040/api/requests/http | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data['requests'][-10:]:
    uri = r.get('request',{}).get('uri','')
    duration = r.get('duration', 0)
    status = r.get('response',{}).get('status','')
    print(f'{duration}ms {status} {uri}')
"
```
