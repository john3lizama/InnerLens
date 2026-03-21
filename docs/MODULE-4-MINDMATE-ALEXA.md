# Module 4 — MindMate Chat + Alexa/Echo Integration

**Owners:** Aahil (AI logic) + John (API + Alexa infra)
**Location:** `reflectxr-backend/app/routers/chat.py`, `app/services/chat_service.py`, and `alexa/` (stretch)

---

## 1. MindMate: How the Pieces Connect

MindMate is NOT a separate service. It is a feature that uses the same backend — specifically the `/chat` router calling into `chat_service`, `emotion_service`, `prompt_builder`, and `image_service`. The only new endpoint is `/chat` and `/chat/generate-from-conversation`.

### Data Flow (Detailed)

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
  4. Call chat_service.get_reply(session_id, message)
     a. Load last 10 messages from DB
     b. Build context: [system_prompt, ...history, user_message]
     c. Call GPT-4o → get reply text
     d. Save assistant message to messages table
  5. Call emotion_service.extract_emotions(last 3 turns as text)
     → Returns [{"emotion": "stress", "intensity": 0.8}, {"emotion": "overwhelm", "intensity": 0.5}]
     → Save emotion_tags JSONB on the assistant message
  6. Determine should_generate_image:
     → session.message_count >= 6 (3+ user messages)
     → dominant emotion intensity >= 0.7
     → no image already generated for this session
  7. Return response to mobile app
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
chat.py (router)
  1. Load all messages for this session
  2. Call emotion_service.extract_emotions(full conversation text)
  3. Call prompt_builder.build_prompt_from_emotions(emotions)
     → Returns ("Create waves of stress that rise and fade into calm water.", "Watercolor")
  4. Call image_service.generate_images(prompt, style, count=1)
  5. Upload to S3, save GeneratedImage record (source="chat")
  6. Return image URL + emotion summary to mobile app
                                    │
                                    ▼
Mobile app shows ChatImageReveal modal with the generated artwork
```

---

## 2. Implementation Order

**Aahil builds the AI logic. John builds the HTTP + database wiring. They should not block each other.**

### Week 5 — Parallel Work

**Aahil (no HTTP dependency):**
1. Write `chat_service.py` → `get_reply(session_id, message)` function
   - Takes a session_id and message, returns a reply string
   - Can be tested with a standalone Python script — no FastAPI needed
2. Wire `safety.py` check into the flow
3. Test with 10+ sample conversations, verify tone and length

**John (no AI dependency):**
1. Write `POST /chat` router
   - Session creation, message storage, response shape
   - Mock the AI reply as `"I hear you. Tell me more."` until Aahil's module is ready
2. Write session management (create, load messages, count messages)
3. Test that sessions persist and messages are ordered correctly

### Week 5.5 — Integration
- John replaces the mock reply with a call to `chat_service.get_reply()`
- Aahil provides `emotion_service.extract_emotions()` and John wires it into the response
- Test the full flow together

### Week 6 — Auto-Generation
- Aahil writes `prompt_builder.build_prompt_from_emotions()`
- John writes `POST /chat/generate-from-conversation`
- Wire them together. Test that emotions → prompt → image works.

---

## 3. MindMate Session Lifecycle

```
[User opens MindMate]
         │
         ▼
  sessionId = null (no session yet)
         │
         ├─── User sends first message
         │    POST /chat { session_id: null, message: "..." }
         │    → Backend creates Session, returns session_id
         │    → Frontend stores session_id for subsequent calls
         │
         ├─── User sends more messages
         │    POST /chat { session_id: "abc-123", message: "..." }
         │    → Backend appends to existing session
         │
         ├─── Auto-generation triggered (should_generate_image: true)
         │    POST /chat/generate-from-conversation { session_id: "abc-123" }
         │    → Backend generates image, returns URL
         │    → Frontend shows ChatImageReveal
         │
         └─── User closes chat or starts new session
              → Session persists in DB for journal history
```

---

## 4. Alexa/Echo Integration (Stretch Goal — Week 8)

The Alexa skill is a voice interface to the same MindMate API. It does NOT require a separate backend.

### Architecture

```
User speaks to Echo → Alexa Service → Lambda Function → POST /chat (your API) → Response → Alexa speaks reply
```

### Setup (Aahil + John pair on this)

1. **Create an Alexa Custom Skill** via the Alexa Developer Console
   - Invocation name: "mind mate" or "inner lens"
   - Create custom intents: `CheckInIntent`, `GroundingIntent`, `FreeFormIntent`

2. **Lambda Function** (Python, deployed on AWS)
   ```python
   import httpx

   API_URL = "https://your-deployed-api.com"

   def lambda_handler(event, context):
       intent = event["request"]["intent"]["name"]
       session_attrs = event["session"].get("attributes", {})
       session_id = session_attrs.get("session_id")

       if intent == "FreeFormIntent":
           user_text = event["request"]["intent"]["slots"]["message"]["value"]
           response = httpx.post(f"{API_URL}/chat", json={
               "session_id": session_id,
               "message": user_text,
           }, headers={"Authorization": f"Bearer {API_TOKEN}"})

           data = response.json()
           return build_alexa_response(
               speech=data["reply"],
               session_attrs={"session_id": data["session_id"]},
               should_end=False,
           )
   ```

3. **Interaction Model** (simplified)
   ```json
   {
     "intents": [
       {
         "name": "FreeFormIntent",
         "slots": [{ "name": "message", "type": "AMAZON.SearchQuery" }],
         "samples": [
           "{message}",
           "I'm feeling {message}",
           "I want to talk about {message}"
         ]
       }
     ]
   }
   ```

### What Makes a Good Demo (Even If Basic)
- "Alexa, open Mind Mate"
- "I've been feeling anxious about work"
- Alexa responds with MindMate's empathetic reply
- After 2-3 turns: "I've created some artwork based on our conversation. Open InnerLens on your phone to see it."
- That last part is just a spoken message — the actual image was generated on the backend and is visible in the mobile app.

### Minimum Viable Alexa Demo: 2-3 hours of work
- 1 intent (`FreeFormIntent` with `AMAZON.SearchQuery` slot)
- 1 Lambda function that proxies to your API
- Hard-coded auth token (it's a demo)
- No account linking needed for the demo

---

## 5. What NOT to Build

- Do not build a separate Alexa backend. Use the same `/chat` endpoint.
- Do not build Alexa account linking (OAuth flow). Use a hardcoded token for the demo.
- Do not try to play images on the Echo Show. Just speak a message that says "check your phone."
- Do not invest more than 6-8 hours total on Alexa. If the core app isn't rock solid, skip Alexa entirely.
