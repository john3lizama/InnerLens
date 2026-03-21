# InnerLens — ReflectXR + MindMate

Build the **Reflect XR** mobile app (required by ChallengeX) and add **MindMate** as a standout feature — an AI chatbot that converses with the user, detects their emotional state, and automatically generates art based on how they're feeling, without the user needing to craft prompts manually.

---

## Tech Stack

- **Frontend:** React Native (Expo) + TypeScript
- **Backend:** FastAPI (Python 3.11)
- **Database:** PostgreSQL 16 via Supabase
- **AI/ML:** OpenAI GPT-4o (chat) + DALL-E 3 / Stability AI (images)
- **Voice:** Amazon Alexa Custom Skill (stretch goal)
- **Infrastructure:** Docker, NGINX, GitHub Actions

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│   ┌───────────────────┐          ┌───────────────────┐              │
│   │  React Native App │          │   Alexa / Echo    │              │
│   │  (Expo - Mobile)  │          │  (Voice Skill)    │              │
│   │                   │          │                   │              │
│   │  • Home           │          │  • CheckInIntent  │              │
│   │  • Concepts       │          │  • GroundingIntent│              │
│   │  • Prompt Design  │          │  • ReflectIntent  │              │
│   │  • MindMate Chat  │          │                   │              │
│   │  • Journal        │          │                   │              │
│   └────────┬──────────┘          └────────┬──────────┘              │
│            │ HTTPS                        │ HTTPS                   │
└────────────┼──────────────────────────────┼─────────────────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (NGINX)                          │
│                     reverse proxy → :8000                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND — FastAPI                                │
│                                                                     │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐ │
│  │ /auth    │ │ /concepts │ │ /generate │ │ /chat  │ │ /journal │ │
│  │          │ │           │ │           │ │        │ │          │ │
│  │ register │ │ list      │ │ create    │ │ send   │ │ create   │ │
│  │ login    │ │ get by id │ │ select    │ │ gen    │ │ list     │ │
│  │ me       │ │ styles    │ │           │ │ from   │ │ get      │ │
│  └────┬─────┘ └─────┬─────┘ └─────┬─────┘ │ convo │ └────┬─────┘ │
│       │             │             │        └───┬────┘      │       │
│       ▼             ▼             ▼            ▼           ▼       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SERVICES LAYER                            │   │
│  │                                                             │   │
│  │  auth_service  ·  image_service  ·  chat_service            │   │
│  │  emotion_service  ·  prompt_builder                         │   │
│  └──────────┬────────────────┬────────────────┬────────────────┘   │
│             │                │                │                     │
└─────────────┼────────────────┼────────────────┼─────────────────────┘
              │                │                │
              ▼                ▼                ▼
┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐
│   PostgreSQL     │  │   Supabase     │  │   AI APIs            │
│   (Docker)       │  │   Storage      │  │                      │
│                  │  │                │  │  • OpenAI GPT-4o     │
│  • users         │  │  • generated   │  │    (chat + emotion)  │
│  • concepts      │  │    images      │  │  • DALL-E 3 /        │
│  • sessions      │  │  • avatars     │  │    Stability AI      │
│  • messages      │  │               │  │    (image gen)       │
│  • images        │  │               │  │                      │
│  • journal       │  │               │  │                      │
│  • emotion_tags  │  │               │  │                      │
└──────────────────┘  └────────────────┘  └──────────────────────┘
```

## MindMate Chat → Auto Art Generation Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│  User    │     │  /chat       │     │  chat_service    │     │  OpenAI        │
│  types   │────▶│  endpoint    │────▶│                  │────▶│  GPT-4o        │
│  message │     │              │     │  1. crisis check │     │                │
└──────────┘     └──────────────┘     │  2. add context  │     │  system prompt │
                                      │  3. call LLM     │     │  + history     │
                                      └────────┬─────────┘     └───────┬────────┘
                                               │                       │
                                               ▼                       ▼
                                      ┌──────────────────┐     ┌────────────────┐
                                      │ emotion_service  │     │  LLM reply     │
                                      │                  │◀────│  returned      │
                                      │ extract emotions │     └────────────────┘
                                      │ from conversation│
                                      └────────┬─────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │  3+ exchanges AND   │
                                    │  clear emotion?     │
                                    ├───── YES ───────────┤
                                    │                     │
                                    ▼                     ▼ NO
                          ┌──────────────────┐    ┌──────────────┐
                          │  prompt_builder  │    │  Return chat │
                          │                  │    │  response    │
                          │  emotion → art   │    │  only        │
                          │  prompt mapping  │    └──────────────┘
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  image_service   │
                          │                  │
                          │  DALL-E 3 /      │
                          │  Stability AI    │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Art appears in  │
                          │  chat without    │
                          │  user prompting  │
                          └──────────────────┘
```

## Core App Flow (Required by ChallengeX)

```
┌────────────┐    ┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│   Home     │    │   Concepts     │    │  Prompt Design  │    │   Response     │
│   Screen   │───▶│   Screen       │───▶│   Screen        │───▶│   Screen       │
│            │    │                │    │                 │    │                │
│ Create     │    │ • Safe Space   │    │ Shows template  │    │ 4 AI-generated │
│ Learn      │    │ • Emot. Waves  │    │ Emotion dropdown│    │ images in grid │
│ Reflect    │    │ • Resilience   │    │ Style dropdown  │    │ User picks one │
│ MindMate   │    │ • Journey      │    │                 │    │                │
│ Journal    │    │ • Inner Garden │    │ "Generate" btn  │    │ "Select" btn   │
└────────────┘    └────────────────┘    └─────────────────┘    └───────┬────────┘
                                                                       │
                                                                       ▼
                                                               ┌────────────────┐
                                                               │   Reflect      │
                                                               │   Screen       │
                                                               │                │
                                                               │ Selected image │
                                                               │ Journal input  │
                                                               │ Reflection Q   │
                                                               │ Emotion tags   │
                                                               │                │
                                                               │ → saved to DB  │
                                                               └────────────────┘
```

---

## Project Structure

```
InnerLens/
├── README.md
├── LICENSE
└── reflect-xr/
    ├── reflectxr-backend/                # FastAPI — John & Aahil
    │   ├── app/
    │   │   ├── main.py                   # FastAPI app entry, CORS, router registration
    │   │   ├── config.py                 # Pydantic settings (DB, Supabase, OpenAI, JWT)
    │   │   ├── __init__.py
    │   │   ├── ai/                       # AI modules — Aahil
    │   │   │   ├── __init__.py
    │   │   │   ├── system_prompts.py     # MindMate + emotion extraction prompts
    │   │   │   ├── safety.py             # Crisis keyword detection + 988 fallback
    │   │   │   └── emotion_map.py        # Emotion → concept/style mapping
    │   │   ├── models/                   # SQLAlchemy ORM models
    │   │   │   ├── __init__.py
    │   │   │   ├── user.py
    │   │   │   ├── concept.py
    │   │   │   ├── session.py
    │   │   │   ├── message.py
    │   │   │   ├── generated_image.py
    │   │   │   └── journal_entry.py
    │   │   ├── schemas/                  # Pydantic request/response schemas
    │   │   │   ├── __init__.py
    │   │   │   ├── auth.py
    │   │   │   ├── concept.py
    │   │   │   ├── generate.py
    │   │   │   ├── chat.py
    │   │   │   └── journal.py
    │   │   ├── routers/                  # FastAPI route handlers
    │   │   │   ├── __init__.py
    │   │   │   ├── auth.py               # POST /auth/register, /auth/login, GET /auth/me
    │   │   │   ├── concepts.py           # GET /concepts, GET /styles
    │   │   │   ├── generate.py           # POST /generate, POST /generate/select
    │   │   │   ├── chat.py               # POST /chat, POST /chat/generate-from-conversation
    │   │   │   └── journal.py            # GET /journal, GET /journal/:id, POST /journal
    │   │   ├── services/                 # Business logic layer
    │   │   │   ├── __init__.py
    │   │   │   ├── auth_service.py       # JWT + Supabase auth
    │   │   │   ├── image_service.py      # DALL-E 3 / Stability AI calls
    │   │   │   ├── chat_service.py       # LLM conversation + context management
    │   │   │   ├── emotion_service.py    # NLP emotion extraction + tagging
    │   │   │   └── prompt_builder.py     # Emotion → image prompt assembly
    │   │   ├── db/
    │   │   │   ├── __init__.py
    │   │   │   ├── database.py           # Async SQLAlchemy engine + session
    │   │   │   └── seed.py               # Seed concepts, styles, prompt templates
    │   │   └── utils/
    │   │       ├── __init__.py
    │   │       └── storage.py            # Supabase Storage helpers
    │   ├── alembic/                      # Database migrations
    │   │   ├── env.py
    │   │   └── versions/
    │   │       └── 001_initial.py
    │   ├── alembic.ini
    │   ├── nginx/
    │   │   └── nginx.conf                # Reverse proxy config
    │   ├── tests/
    │   │   ├── __init__.py
    │   │   ├── conftest.py
    │   │   ├── test_auth.py
    │   │   ├── test_concepts.py
    │   │   ├── test_generate.py
    │   │   └── test_chat.py
    │   ├── Dockerfile                    # Python 3.11 container
    │   ├── docker-compose.yml            # Postgres + API + NGINX
    │   ├── requirements.txt              # Pinned dependencies
    │   ├── .env.example                  # Environment variable template
    │   └── .gitignore
    │
    └── reflectxr-mobile/                 # React Native (Expo) — Mohammed & Terina
        ├── .env                          # EXPO_PUBLIC_API_URL
        └── src/
            ├── navigation/               # React Navigation setup
            │   ├── AppNavigator.tsx       # Root navigator (auth vs main)
            │   ├── AuthStack.tsx          # Login / Register stack
            │   ├── MainTabs.tsx           # Bottom tab navigator
            │   └── types.ts              # Navigation type definitions
            ├── screens/
            │   ├── auth/
            │   │   ├── LoginScreen.tsx
            │   │   └── RegisterScreen.tsx
            │   ├── home/
            │   │   └── HomeScreen.tsx     # Create, Learn, Reflect, MindMate cards
            │   ├── create/
            │   │   ├── ConceptsScreen.tsx     # Concept selection grid
            │   │   ├── PromptDesignScreen.tsx # Template + emotion + style dropdowns
            │   │   ├── PromptEditScreen.tsx   # Optional prompt editing
            │   │   ├── ResponseScreen.tsx     # 2x2 generated image grid + select
            │   │   └── ReflectScreen.tsx      # Image + journal + reflection prompt
            │   ├── chat/
            │   │   ├── ChatScreen.tsx         # MindMate conversation interface
            │   │   └── ChatImageReveal.tsx    # Auto-generated art reveal animation
            │   ├── journal/
            │   │   ├── JournalListScreen.tsx  # Past entries with emotion tags
            │   │   └── JournalDetailScreen.tsx
            │   └── profile/
            │       └── ProfileScreen.tsx
            ├── components/
            │   ├── ui/                    # Reusable design system components
            │   │   ├── Button.tsx
            │   │   ├── Card.tsx
            │   │   ├── Input.tsx
            │   │   ├── Dropdown.tsx
            │   │   ├── LoadingSpinner.tsx
            │   │   ├── EmotionTag.tsx
            │   │   └── SafeAreaWrapper.tsx
            │   ├── chat/
            │   │   ├── ChatBubble.tsx
            │   │   ├── ChatInput.tsx
            │   │   └── TypingIndicator.tsx
            │   ├── create/
            │   │   ├── ConceptCard.tsx
            │   │   ├── ImageGrid.tsx
            │   │   ├── StylePicker.tsx
            │   │   └── ReflectionPrompt.tsx
            │   └── journal/
            │       ├── JournalCard.tsx
            │       └── EmotionTagList.tsx
            ├── services/                  # API service layer (axios)
            │   ├── api.ts                 # Axios instance + auth interceptor
            │   ├── authService.ts
            │   ├── conceptService.ts
            │   ├── generateService.ts
            │   ├── chatService.ts
            │   └── journalService.ts
            ├── hooks/
            │   ├── useAuth.ts
            │   ├── useChat.ts
            │   └── useConcepts.ts
            ├── context/
            │   ├── AuthContext.tsx
            │   └── ThemeContext.tsx
            ├── theme/                     # Calming wellness design tokens
            │   ├── index.ts
            │   ├── colors.ts             # Muted blues, purples, warm neutrals
            │   ├── typography.ts
            │   └── spacing.ts
            ├── types/                     # Shared TypeScript interfaces
            │   ├── concept.ts
            │   ├── chat.ts
            │   ├── journal.ts
            │   ├── user.ts
            │   └── image.ts
            ├── utils/
            │   ├── formatDate.ts
            │   └── emotionColors.ts
            └── assets/
                ├── images/
                └── fonts/
```

---

## Team Assignments

### Mohammed Abdur Rahman — Frontend Lead
**Skills:** React Native, Swift, iOS, Docker, System Design
**Previous:** Software Engineer Intern @ Apple

**Responsibilities:**
- Own the React Native (Expo) codebase end-to-end
- Set up the Expo project with TypeScript and React Navigation
- Build all screen components using Terina's Figma designs
- Create the API service layer (`src/services/api.ts`) that connects to John's FastAPI endpoints
- Build the MindMate Chat screen — FlatList of message bubbles that POSTs to `/chat`
- Handle loading states, error handling, and offline behavior
- Coordinate with John on API request/response contracts

**Week-by-Week:**
| Week | Deliverables |
|------|-------------|
| 1 | Expo project init, navigation structure, stub screens, API service layer |
| 2 | Concepts screen, Prompt Design screen wired to `/concepts` and `/generate` |
| 3 | Response screen (image grid + selection), connect to image generation pipeline |
| 4 | MindMate Chat screen UI, wire to `/chat` endpoint, auto-image reveal flow |
| 5 | Bug fixes, loading/error states, polish transitions and animations |
| 6 | Alexa integration support (if time), final testing on iOS + Android |

---

### John Lizama — Backend Lead
**Skills:** FastAPI, PostgreSQL, Docker, NGINX, Cloud, System Architecture
**Previous:** 1st Place ChallengeX 2025

**Responsibilities:**
- Own the entire FastAPI server, database schema, and Docker deployment
- Build all API endpoints (auth, concepts, generate, chat, journal)
- Set up PostgreSQL with Supabase, write the Alembic migrations
- Dockerize the full stack (API + Postgres + NGINX) from day one
- Integrate Aahil's AI modules into the service layer
- Deploy to cloud (Railway/Render/AWS)

**API Endpoints to Build:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user account |
| POST | `/auth/login` | Authenticate, return JWT |
| GET | `/auth/me` | Get current user profile |
| GET | `/concepts` | List all concept cards with prompt templates |
| GET | `/styles` | List available art styles |
| POST | `/generate` | Assemble prompt → call image API → return images |
| POST | `/generate/select` | Mark selected image for a session |
| POST | `/chat` | Send message → LLM reply + emotion extraction |
| POST | `/chat/generate-from-conversation` | Auto-generate art from chat emotions |
| GET | `/journal` | List user's journal entries |
| GET | `/journal/:id` | Get single journal entry |
| POST | `/journal` | Save reflection + link to image + emotion tags |

**Week-by-Week:**
| Week | Deliverables |
|------|-------------|
| 1 | FastAPI scaffold, Docker Compose, Supabase setup, DB schema, `/health` endpoint |
| 2 | `/auth/*` endpoints, `/concepts` + `/styles` with seed data |
| 3 | `/generate` endpoint wired to image API, Supabase Storage integration |
| 4 | `/chat` endpoint, session management, integrate Aahil's chat engine + emotion extraction |
| 5 | `/journal` CRUD, emotion tagging on entries, `/chat/generate-from-conversation` |
| 6 | Cloud deployment, Alexa webhook (stretch), load testing |

---

### Aahil Shaik — AI/ML Lead
**Skills:** Python, AWS, LLM Integration, AI Prompting
**Previous:** 1st Place ChallengeX 2025

**Responsibilities:**
- Own all AI logic that the backend calls
- Design and iterate the MindMate system prompt (3 modes: check-in, grounding, reflection)
- Build the emotion extraction pipeline (LLM-based NLP to extract emotions + intensity)
- Build the prompt builder that maps emotions → concept art prompts automatically
- Implement crisis keyword detection + 988 fallback safety module
- Build the Alexa Custom Skill (stretch goal)

**Modules to Build:**

| Module | File | Purpose |
|--------|------|---------|
| Chat Engine | `app/services/chat_service.py` | System prompt, conversation context (last 5 turns), LLM API call |
| Emotion Extractor | `app/services/emotion_service.py` | Secondary LLM call to extract emotion + intensity JSON |
| Prompt Builder | `app/services/prompt_builder.py` | Map extracted emotions → concept templates → image prompts |
| Emotion Map | `app/ai/emotion_map.py` | Emotion keyword → concept/style lookup table |
| Safety Filter | `app/ai/safety.py` | Crisis keyword check, short-circuit to 988 response |
| System Prompts | `app/ai/system_prompts.py` | MindMate personality + emotion extraction instructions |

**Week-by-Week:**
| Week | Deliverables |
|------|-------------|
| 1 | Get API keys, test LLM + image gen in standalone scripts, finalize system prompt |
| 2 | Emotion extraction module, test with sample conversations |
| 3 | Prompt builder (emotion → art prompt), integrate into `/generate` |
| 4 | Wire chat engine into `/chat`, auto-image trigger logic after 3+ exchanges |
| 5 | Crisis detection + 988 fallback, session memory (last 5 turns), edge case testing |
| 6 | Alexa Custom Skill (stretch), demo prep with example conversations |

---

### Terina Ishaqzai — UX/UI Lead + Frontend Support
**Skills:** UI/UX Design, React Native, DevOps, Graphical Design
**Previous:** DermaLens Hackathon Project

**Responsibilities:**
- Own the design system and visual identity (calming, wellness-focused aesthetic)
- Create all Figma mockups before Mohammed builds each screen
- Build the reusable component library (`src/components/ui/*`)
- Own the Reflect/Journal screen end-to-end (most design-sensitive screen)
- Design the MindMate chat-to-art reveal interaction
- Lead user testing sessions (3-5 testers, required deliverable)

**Design System:**
- Color palette: muted blues, gentle purples, warm neutrals (see `src/theme/colors.ts`)
- Typography: clean, readable, calming (see `src/theme/typography.ts`)
- Spacing: generous whitespace, rounded corners (see `src/theme/spacing.ts`)
- Components: `Button`, `Card`, `Input`, `Dropdown`, `EmotionTag`, `ConceptCard`, `ChatBubble`

**Week-by-Week:**
| Week | Deliverables |
|------|-------------|
| 1 | Figma mockups for all screens, color palette, component library start |
| 2 | Build `Button`, `Card`, `Input`, `Dropdown`, `ConceptCard`, `StylePicker` |
| 3 | Response screen (ImageGrid + selection UI), Reflect screen (journal + image) |
| 4 | Chat UI design, `ChatBubble`, `ChatInput`, `TypingIndicator`, art reveal animation |
| 5 | User testing with 3-5 people, feedback collection, UX iteration |
| 6 | Final polish, presentation slides, 2-page project summary report |

---

## Database Schema

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│    users     │     │    concepts      │     │     sessions       │
├──────────────┤     ├──────────────────┤     ├────────────────────┤
│ id (UUID PK) │     │ id (UUID PK)     │     │ id (UUID PK)       │
│ email        │     │ title            │     │ user_id (FK users) │
│ display_name │     │ slug             │     │ concept_id (FK)    │
│ hashed_pw    │     │ prompt_template  │     │ source (concept/   │
│ preferred_   │     │ dropdown_label   │     │   chat/freeform)   │
│   style      │     │ dropdown_options │     │ created_at         │
│ created_at   │     │ reflection_prompt│     │ updated_at         │
└──────┬───────┘     │ category         │     └──────┬─────────────┘
       │             └──────────────────┘            │
       │                                             │
       │         ┌───────────────────┐               │
       │         │    messages       │               │
       │         ├───────────────────┤               │
       │         │ id (UUID PK)      │               │
       └────────▶│ session_id (FK)   │◀──────────────┘
                 │ role (user/asst)  │
                 │ content           │       ┌────────────────────┐
                 │ emotion_tags JSON │       │ generated_images   │
                 │ created_at        │       ├────────────────────┤
                 └───────────────────┘       │ id (UUID PK)       │
                                             │ session_id (FK)    │
       ┌─────────────────────┐               │ prompt_used        │
       │  journal_entries    │               │ style_used         │
       ├─────────────────────┤               │ image_url          │
       │ id (UUID PK)        │               │ thumbnail_url      │
       │ user_id (FK users)  │               │ is_selected (bool) │
       │ image_id (FK images)│◀──────────────│ source             │
       │ session_id (FK)     │               │ created_at         │
       │ content             │               └────────────────────┘
       │ reflection_prompt   │
       │ emotion_tags JSON   │
       │ word_count          │
       │ created_at          │
       └─────────────────────┘
```

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/your-org/InnerLens.git
cd InnerLens/reflect-xr

# 2. Backend — start Postgres + API + NGINX
cd reflectxr-backend
cp .env.example .env          # Fill in your API keys
docker-compose up -d           # Starts db, api, nginx

# 3. Verify backend is running
curl http://localhost:8000/health
# → {"status": "ok", "service": "reflectxr-api"}

# 4. Frontend — start Expo dev server
cd ../reflectxr-mobile
npm install
npx expo start                 # Scan QR code with Expo Go app

# 5. Run backend tests
cd ../reflectxr-backend
pytest tests/
```

---

## Key Features

1. **Concept-Based Art Generation** — Users pick a concept (Safe Space, Emotional Waves, Resilience, Journey, Inner Garden), select an emotion + style, and get AI-generated art
2. **MindMate AI Chatbot** — Conversational AI that detects emotions and auto-generates art without user prompts (the differentiator)
3. **Reflection Journal** — Users write about their chosen images, with NLP-based emotion tagging
4. **Crisis Safety** — Keyword detection that short-circuits to 988 Suicide & Crisis Lifeline
5. **Alexa Voice Integration** — (Stretch) Hands-free MindMate conversations via Echo device

---

## Demo Script (3 minutes)

1. Open app → pick "Emotional Waves" concept → select "worry" + "watercolor" → generate → select image → write reflection *(shows required ChallengeX functionality)*
2. Open MindMate → say "I've been really stressed about school" → get empathetic reply → watch art auto-generate *(shows the differentiator — art without prompting)*
3. Show journal → emotion tags visible on entries *(shows NLP requirement)*
4. *(Stretch)* Alexa demo: "Alexa, open MindMate" → quick voice conversation
