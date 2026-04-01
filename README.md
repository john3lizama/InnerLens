# InnerLens — ReflectXR + MindMate

**Title:** *Developing an Emotion-Based Generative AI Mobile Experience for Arts & Wellness*
**Sponsor:** Persistent Technology, Inc.
**Timeline:** 9 weeks (part-time — all contributors are full-time students with jobs)

ReflectXR is a cross-platform mobile app that lets users select or describe an emotion, generate AI artwork from that emotion, and reflect on the result through creative journaling. MindMate is our team's original addition — a conversational AI companion that detects emotions from natural conversation and generates art automatically, without the user ever writing a prompt.

---

## Requirement Traceability

Every feature maps back to the sponsor's project brief. This table is the source of truth — if something isn't checked here, it isn't done.

| # | Sponsor Requirement | Where It Lives | Status |
|---|---------------------|---------------|--------|
| R1 | Cross-platform mobile prototype (iOS + Android) | `reflectxr-mobile/` — React Native + Expo | Scaffold done |
| R2 | Generative AI image synthesis from text prompts | `POST /generate` → OpenAI DALL-E 3 / Stability AI | Scaffold done |
| R3 | User-friendly emotion input interface | Concepts screen → Emotion dropdown → Style dropdown | Scaffold done |
| R4 | Creative journaling with image reflection | Reflect screen → Journal entry → saved to DB | Scaffold done |
| R5 | Emotional tagging / NLP keyword association | `emotion_service.py` → tags stored on journal entries | Scaffold done |
| R6 | Word/image linking or tagging feature | Emotion tags displayed on journal list + detail screens | Scaffold done |
| R7 | Calming, reflective, accessible UI/UX design | `src/theme/` — wellness palette, generous spacing | Scaffold done |
| R8 | User testing plan + insights (pilot or focus group) | `docs/user-testing/` — 3-5 testers, feedback forms | Not started |
| R9 | Documentation: architecture, APIs, setup instructions | This README + `docs/` module guides | In progress |
| R10 | Final presentation/demo to project sponsors | `docs/presentation/` — slides + 3-min demo script | Not started |
| **Bonus** | MindMate AI chatbot (emotion → auto art generation) | `POST /chat` → emotion extraction → auto `/generate` | Scaffold done |
| **Bonus** | Alexa/Echo voice integration (stretch) | `alexa/` — Custom Skill → same backend API | Not started |

---

## Tech Stack

| Layer | Technology | Why (Not "Vibes") |
|-------|-----------|-------------------|
| Mobile app | React Native + Expo + TypeScript | Cross-platform from one codebase. Mohammed has iOS/RN experience. Expo handles builds. |
| Backend API | FastAPI (Python 3.11) | Async-native, auto-generates OpenAPI docs, Python ecosystem for AI libs. John owns this. |
| Database | PostgreSQL 16 (Docker) | Industry standard RDBMS. Full control via SQLAlchemy ORM + Alembic migrations. No BaaS. |
| ORM | SQLAlchemy 2.0 (async) | Type-safe models, explicit queries, migration support via Alembic. |
| Object storage | S3-compatible (AWS S3 or Cloudflare R2) | Generated images stored in a bucket. R2 has free egress. Accessed via boto3. |
| Auth | JWT (python-jose + passlib) | Stateless tokens. We own the auth flow — register, login, token refresh. |
| AI — Chat | OpenAI GPT-4o | Best empathetic conversational quality. Used for MindMate + emotion extraction. |
| AI — Images | OpenAI DALL-E 3 or Stability AI | DALL-E 3 for fast integration. Stability for more artistic control + cost savings. |
| Reverse proxy | NGINX (Docker) | Sits in front of the API. Handles SSL termination in prod. |
| Containers | Docker + Docker Compose | One `docker-compose up` for the full backend stack (Postgres + API + NGINX). |
| CI/CD | GitHub Actions | Lint, test, build on every PR. Deploy on merge to main. |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│   ┌───────────────────────┐        ┌────────────────────┐          │
│   │   React Native App    │        │   Alexa/Echo       │          │
│   │   (Expo — iOS/Android)│        │   (Stretch Goal)   │          │
│   │                       │        │                    │          │
│   │ Screens:              │        │ Intents:           │          │
│   │  • Home (Create)      │        │  • CheckInIntent   │          │
│   │  • Concepts           │        │  • GroundingIntent │          │
│   │  • Prompt Design      │        │  • ReflectIntent   │          │
│   │  • Prompt Edit        │        │                    │          │
│   │  • Response           │        │ Voice utterances   │          │
│   │  • Reflect/Journal    │        │ hit same /chat API │          │
│   │  • MindMate Chat      │        │                    │          │
│   │  • Journal History    │        │                    │          │
│   └──────────┬────────────┘        └─────────┬──────────┘          │
│              │ HTTPS (axios)                 │ HTTPS (Lambda)      │
└──────────────┼───────────────────────────────┼──────────────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       NGINX REVERSE PROXY                           │
│                   :80 → proxy_pass → api:8000                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FastAPI APPLICATION SERVER                       │
│                                                                     │
│  ROUTERS (app/routers/)                                             │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐ │
│  │ /auth    │ │ /concepts │ │ /generate │ │ /chat  │ │ /journal │ │
│  │          │ │           │ │           │ │        │ │          │ │
│  │ POST     │ │ GET /     │ │ POST /    │ │ POST / │ │ POST /   │ │
│  │ register │ │ GET /:id  │ │ POST      │ │ POST   │ │ GET /    │ │
│  │ POST     │ │ GET       │ │ /select   │ │ /gen-  │ │ GET /:id │ │
│  │ login    │ │ /styles   │ │           │ │ from-  │ │          │ │
│  │ GET /me  │ │           │ │           │ │ convo  │ │          │ │
│  └────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───┬────┘ └────┬─────┘ │
│       │             │             │            │           │       │
│       ▼             ▼             ▼            ▼           ▼       │
│  SERVICES (app/services/) ─────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ auth_service.py    — JWT issue/verify, password hashing      │  │
│  │ image_service.py   — call DALL-E 3 / Stability AI, upload S3│  │
│  │ chat_service.py    — build LLM context, call GPT-4o          │  │
│  │ emotion_service.py — extract emotions from text via LLM      │  │
│  │ prompt_builder.py  — map emotions → concept prompt templates  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  AI MODULES (app/ai/) ──────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ system_prompts.py  — MindMate personality + extraction rules  │  │
│  │ safety.py          — crisis keyword detection → 988 fallback  │  │
│  │ emotion_map.py     — emotion→concept lookup, intensity scoring│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  DATABASE LAYER (app/db/) ──────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ database.py — async SQLAlchemy engine + sessionmaker          │  │
│  │ seed.py     — populate concepts, styles, prompt templates     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────┬───────────────────────────┬──────────────────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐     ┌──────────────────────┐
│   PostgreSQL 16      │     │   S3 / Cloudflare R2 │
│   (Docker container) │     │   (Object Storage)   │
│                      │     │                      │
│   Tables:            │     │   Buckets:           │
│    • users           │     │    • reflectxr-images │
│    • concepts        │     │      /generated/     │
│    • styles          │     │      /thumbnails/    │
│    • sessions        │     │                      │
│    • messages        │     │                      │
│    • generated_images│     │                      │
│    • journal_entries │     │                      │
│    • emotion_tags    │     │                      │
└──────────────────────┘     └──────────────────────┘
           │
           │  Migrations managed by
           ▼
┌──────────────────────┐
│   Alembic            │
│   alembic/versions/  │
└──────────────────────┘
```

## Core App User Flow (Required — Implements R1-R7)

This is the flow every ChallengeX team must implement. It maps directly to the mockups in the project brief.

```
  ┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
  │  HOME        │     │  CONCEPTS        │     │  PROMPT DESIGN    │
  │  (Create)    │────▶│                  │────▶│                   │
  │              │     │  Pre-defined:    │     │  Shows concept's  │
  │  Tap         │     │   A Safe Space   │     │  prompt template  │
  │  "Create"    │     │   Emot. Waves    │     │  with blanks:     │
  │              │     │   Resilience     │     │                   │
  │              │     │   Journey        │     │  "Create waves of │
  │              │     │   Masks We Wear  │     │  [DROPDOWN:worry, │
  │              │     │   Crossroads     │     │   self-doubt...]  │
  │              │     │   Future Self    │     │   that rise and   │
  │              │     │   Bridges        │     │   gently fade     │
  │              │     │   Friendship     │     │   into calm water"│
  │              │     │   Growing Roots  │     │                   │
  │              │     │   Letting Go     │     │  + Pick a Style   │
  │              │     │   Garden of Peace│     │    dropdown       │
  │              │     │   Rising/Ashes   │     │                   │
  │              │     │                  │     │  [Next] button    │
  └─────────────┘     └─────────────────┘     └────────┬─────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │  PROMPT EDIT      │
                                              │                   │
                                              │  Full assembled   │
                                              │  prompt shown     │
                                              │  in editable      │
                                              │  text field       │
                                              │                   │
                                              │  User CAN modify  │
                                              │  before submit    │
                                              │                   │
                                              │  [Submit] →       │
                                              │  sends to AI API  │
                                              └────────┬─────────┘
                                                        │
                                                        ▼
  ┌─────────────┐     ┌──────────────────┐    ┌──────────────────┐
  │  JOURNAL     │     │  REFLECT          │    │  RESPONSE         │
  │  HISTORY     │◀────│                   │◀───│                   │
  │              │     │  Selected image   │    │  2x2 grid of     │
  │  Past        │     │  displayed large  │    │  generated images │
  │  entries     │     │                   │    │                   │
  │  with        │     │  Reflection Q     │    │  "Select an      │
  │  emotion     │     │  carousel (from   │    │   image"          │
  │  tags        │     │  concept data):   │    │                   │
  │              │     │  "What sticks out │    │  Tap one to       │
  │              │     │   to you most     │    │  select it        │
  │              │     │   about your      │    │                   │
  │              │     │   artwork?"       │    │                   │
  │              │     │                   │    │                   │
  │              │     │  Text input for   │    │                   │
  │              │     │  journal entry    │    │                   │
  │              │     │                   │    │                   │
  │              │     │  Saved to device  │    │                   │
  │              │     │  + database       │    │                   │
  └─────────────┘     └──────────────────┘    └──────────────────┘
```

## MindMate Chat Flow (Bonus Feature — Our Differentiator)

```
  User opens MindMate
         │
         ▼
  ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐
  │ User types   │───▶│ POST /chat        │───▶│ safety.py       │
  │ message      │    │                   │    │ check_crisis()  │
  └──────────────┘    └───────────────────┘    └────────┬────────┘
                                                        │
                                          ┌─────────────┴───────────┐
                                          │  Crisis detected?       │
                                          ├──── YES ────────────────┤
                                          │                         │
                                          ▼                         ▼ NO
                                 ┌────────────────┐      ┌──────────────────┐
                                 │ Return 988     │      │ chat_service.py  │
                                 │ crisis message │      │                  │
                                 │ immediately    │      │ Build context:   │
                                 └────────────────┘      │  system prompt   │
                                                         │  + last N turns  │
                                                         │  + user message  │
                                                         │                  │
                                                         │ Call GPT-4o      │
                                                         └────────┬─────────┘
                                                                  │
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │ emotion_service  │
                                                         │                  │
                                                         │ Extract emotions │
                                                         │ + intensity from │
                                                         │ the conversation │
                                                         │ via LLM call     │
                                                         └────────┬─────────┘
                                                                  │
                                                    ┌─────────────┴───────────┐
                                                    │  3+ turns AND           │
                                                    │  clear dominant emotion?│
                                                    ├──── YES ────────────────┤
                                                    │                         │
                                                    ▼                         ▼ NO
                                           ┌────────────────┐      ┌─────────────────┐
                                           │ prompt_builder  │      │ Return reply    │
                                           │                 │      │ + emotion tags  │
                                           │ Map emotion →   │      │ to mobile app   │
                                           │ concept template│      └─────────────────┘
                                           │ + auto-select   │
                                           │ style           │
                                           └───────┬─────────┘
                                                   │
                                                   ▼
                                           ┌────────────────┐
                                           │ image_service   │
                                           │                 │
                                           │ Generate art    │
                                           │ via DALL-E 3    │
                                           │ Upload to S3    │
                                           └───────┬─────────┘
                                                   │
                                                   ▼
                                           ┌────────────────────────┐
                                           │ Return reply           │
                                           │ + emotion tags         │
                                           │ + image URL            │
                                           │                        │
                                           │ Art appears in chat    │
                                           │ without user ever      │
                                           │ writing a prompt       │
                                           └────────────────────────┘
```

---

## Project Structure

```
InnerLens/
├── README.md                              ← you are here
├── LICENSE
├── reflect-xr/
│   ├── reflectxr-backend/                 ── John (Backend) + Aahil (AI) ──
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py                    # FastAPI entry point, CORS, router mounts
│   │   │   ├── config.py                  # Pydantic settings (DB, S3, OpenAI, JWT)
│   │   │   │
│   │   │   ├── routers/                   # ── HTTP layer (thin — delegates to services)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py               # POST /register, /login   GET /me
│   │   │   │   ├── concepts.py           # GET /concepts, /styles
│   │   │   │   ├── generate.py           # POST /generate, /generate/select
│   │   │   │   ├── chat.py               # POST /chat, /chat/generate-from-conversation
│   │   │   │   └── journal.py            # POST /journal   GET /journal, /journal/:id
│   │   │   │
│   │   │   ├── services/                  # ── Business logic (testable, no HTTP deps)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth_service.py        # password hashing, JWT issue/verify
│   │   │   │   ├── image_service.py       # call DALL-E / Stability, upload to S3
│   │   │   │   ├── chat_service.py        # build LLM context, manage turns, call GPT
│   │   │   │   ├── emotion_service.py     # LLM-based emotion extraction → JSON tags
│   │   │   │   └── prompt_builder.py      # emotion + concept → assembled image prompt
│   │   │   │
│   │   │   ├── ai/                        # ── AI configuration (prompts, safety, maps)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── system_prompts.py      # MindMate persona, emotion extraction rules
│   │   │   │   ├── safety.py              # crisis keyword list + 988 fallback
│   │   │   │   └── emotion_map.py         # emotion → concept/style lookup table
│   │   │   │
│   │   │   ├── models/                    # ── SQLAlchemy ORM models
│   │   │   │   ├── __init__.py
│   │   │   │   ├── user.py
│   │   │   │   ├── concept.py             # includes styles + prompt templates
│   │   │   │   ├── session.py
│   │   │   │   ├── message.py
│   │   │   │   ├── generated_image.py
│   │   │   │   └── journal_entry.py
│   │   │   │
│   │   │   ├── schemas/                   # ── Pydantic request/response schemas
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── concept.py
│   │   │   │   ├── generate.py
│   │   │   │   ├── chat.py
│   │   │   │   └── journal.py
│   │   │   │
│   │   │   ├── db/                        # ── Database connection + seed data
│   │   │   │   ├── __init__.py
│   │   │   │   ├── database.py            # async engine + session factory
│   │   │   │   └── seed.py               # populate concepts, styles, templates
│   │   │   │
│   │   │   └── utils/                     # ── Shared helpers
│   │   │       ├── __init__.py
│   │   │       └── storage.py             # S3/R2 upload/download helpers (boto3)
│   │   │
│   │   ├── alembic/                       # DB migrations
│   │   │   ├── env.py
│   │   │   └── versions/
│   │   │       └── 001_initial.py
│   │   ├── alembic.ini
│   │   │
│   │   ├── nginx/
│   │   │   └── nginx.conf
│   │   │
│   │   ├── tests/
│   │   │   ├── __init__.py
│   │   │   ├── conftest.py
│   │   │   ├── test_auth.py
│   │   │   ├── test_concepts.py
│   │   │   ├── test_generate.py
│   │   │   └── test_chat.py
│   │   │
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── .gitignore
│   │
│   └── reflectxr-mobile/                  ── Mohammed (Frontend) + Terina (UX/UI) ──
│       ├── .env
│       └── src/
│           ├── screens/                   # ── One file per screen, grouped by flow
│           │   ├── auth/
│           │   │   ├── LoginScreen.tsx
│           │   │   └── RegisterScreen.tsx
│           │   ├── home/
│           │   │   └── HomeScreen.tsx
│           │   ├── create/                # ── The core concept→image→reflect flow
│           │   │   ├── ConceptsScreen.tsx
│           │   │   ├── PromptDesignScreen.tsx
│           │   │   ├── PromptEditScreen.tsx
│           │   │   ├── ResponseScreen.tsx
│           │   │   └── ReflectScreen.tsx
│           │   ├── chat/                  # ── MindMate bonus feature
│           │   │   ├── ChatScreen.tsx
│           │   │   └── ChatImageReveal.tsx
│           │   ├── journal/
│           │   │   ├── JournalListScreen.tsx
│           │   │   └── JournalDetailScreen.tsx
│           │   └── profile/
│           │       └── ProfileScreen.tsx
│           │
│           ├── components/                # ── Reusable UI atoms, grouped by domain
│           │   ├── ui/                    # Button, Card, Input, Dropdown, etc.
│           │   ├── chat/                  # ChatBubble, ChatInput, TypingIndicator
│           │   ├── create/                # ConceptCard, ImageGrid, StylePicker
│           │   └── journal/               # JournalCard, EmotionTagList
│           │
│           ├── services/                  # ── API layer (axios → FastAPI endpoints)
│           │   ├── api.ts                 # axios instance + auth interceptor
│           │   ├── authService.ts
│           │   ├── conceptService.ts
│           │   ├── generateService.ts
│           │   ├── chatService.ts
│           │   └── journalService.ts
│           │
│           ├── navigation/                # React Navigation setup
│           ├── hooks/                     # useAuth, useChat, useConcepts
│           ├── context/                   # AuthContext, ThemeContext
│           ├── theme/                     # colors, typography, spacing
│           ├── types/                     # TypeScript interfaces
│           ├── utils/                     # formatDate, emotionColors
│           └── assets/                    # images, fonts
│
└── docs/                                  ── Deliverable documentation ──
    ├── MODULE-1-FRONTEND.md
    ├── MODULE-2-BACKEND.md
    ├── MODULE-3-AI.md
    ├── MODULE-4-MINDMATE-ALEXA.md
    ├── MODULE-5-UX-TESTING.md
    ├── user-testing/
    └── presentation/
```

---

## Team

| Name | Role | Key Skills | Strengths to Leverage |
|------|------|------------|----------------------|
| Mohammed Abdur Rahman | Frontend Lead | React Native, Swift, iOS, Docker, System Design | Apple intern — production-grade mobile patterns |
| John Lizama | Backend Lead | FastAPI, PostgreSQL, Docker, NGINX, Cloud, System Architecture | 1st Place ChallengeX 2025 — knows what judges want |
| Aahil Shaik | AI/ML Lead | Python, AWS, LLM Integration, AI Prompting, Cloud | 1st Place ChallengeX 2025 — strong on AI integration |
| Terina Ishaqzai | UX/UI Lead + Frontend Support | UI/UX Design, React Native, DevOps, Graphical Design | DermaLens hackathon — fast UI iteration |

---

## 9-Week Schedule (Realistic for Working Students)

Each week assumes ~8-12 hours per person. Weekends are the primary work blocks. Wednesday evening is the sync meeting.

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Every team member can run the app locally. Backend returns real data. Frontend renders real screens.

| Person | Week 1 | Week 2 |
|--------|--------|--------|
| **Mohammed** | Init Expo project with TypeScript. Set up React Navigation (AuthStack + MainTabs). Create stub screens that render their names. Push to GitHub. | Build HomeScreen with "Create" card (matches mockup). Build ConceptsScreen with hardcoded concept buttons. Wire to navigation. |
| **John** | Scaffold FastAPI. Write `docker-compose.yml`. Create all SQLAlchemy models. Run first Alembic migration. `GET /health` returns 200. | Build `GET /concepts` + `GET /styles` (returns seeded data from DB). Build `POST /auth/register` + `POST /auth/login` (JWT). Deploy dev instance. |
| **Aahil** | Get OpenAI API key. Write standalone Python script that sends a prompt to DALL-E 3 and saves the image. Test 5 concept prompts from the brief. | Write standalone script that sends a conversation to GPT-4o with the MindMate system prompt. Validate tone and response length. |
| **Terina** | Create Figma mockups for: Home, Concepts, Prompt Design, Prompt Edit. Use the sponsor's mockups as the baseline. Define color palette + typography. | Build `Button`, `Card`, `Input`, `Dropdown` components in `src/components/ui/`. Start `ConceptCard` component. |

**Milestone check (end of Week 2):** App runs on phones via Expo Go. `docker-compose up` starts Postgres + API. `GET /concepts` returns the 14 concepts from the brief. All 4 people have committed code.

### Phase 2: Core Pipeline (Weeks 3-4)

**Goal:** A user can go from Home → Concepts → Prompt Design → Prompt Edit → Response (4 images) → Reflect (journal). This is the required ChallengeX flow.

| Person | Week 3 | Week 4 |
|--------|--------|--------|
| **Mohammed** | Build PromptDesignScreen: show concept template, emotion dropdown, style dropdown, "Next" button. Build PromptEditScreen: editable text field + "Submit" button. | Build ResponseScreen: 2x2 image grid with tap-to-select. Build ReflectScreen: selected image + reflection question carousel + journal text input + save button. |
| **John** | Build `POST /generate`: accept prompt + style → call image service → store 4 images in S3 → return URLs. Build `POST /generate/select`: mark chosen image. | Build `POST /journal`: save journal entry with linked image + session. Build `GET /journal` + `GET /journal/:id`. Wire emotion tags to journal entries. |
| **Aahil** | Integrate image generation into `image_service.py`. Handle DALL-E 3 response parsing, S3 upload, thumbnail generation. Error handling for rate limits. | Build `emotion_service.py`: takes journal text → calls GPT with extraction prompt → returns JSON emotion tags. Integrate into journal save flow. |
| **Terina** | Build `StylePicker`, `ImageGrid`, `ReflectionPrompt` components. Design the Prompt Edit and Response screens in Figma (if not done). | Build the ReflectScreen UI end-to-end (most design-sensitive screen). Design the emotion tag chips. Start `JournalCard` component. |

**Milestone check (end of Week 4):** The full Create flow works end-to-end. A user picks "Emotional Waves", selects "worry", picks "watercolor", edits the prompt, submits, sees 4 images, picks one, writes a journal entry with a reflection question, and it saves. This satisfies R1-R7.

### Phase 3: MindMate + Polish (Weeks 5-6)

**Goal:** MindMate chatbot works. Emotion tags appear on journal entries. App feels polished.

| Person | Week 5 | Week 6 |
|--------|--------|--------|
| **Mohammed** | Build ChatScreen: FlatList of message bubbles, text input, send button. Wire to `POST /chat`. Handle loading states + typing indicator. | Build ChatImageReveal screen (when chat auto-generates art). Build JournalListScreen + JournalDetailScreen. Show emotion tags on journal cards. |
| **John** | Build `POST /chat`: receive message → call chat_service → return reply + emotion tags. Session management (create session on first message, store messages). | Build `POST /chat/generate-from-conversation`: when `should_generate_image=true`, auto-run prompt builder + image service. Return image URL in chat response. |
| **Aahil** | Wire `chat_service.py`: system prompt + conversation context (last 5 turns) + user message → GPT-4o. Wire `safety.py` check before every LLM call. | Build `prompt_builder.py`: take extracted emotions → map to closest concept template → assemble image prompt → select style. This is the auto-generation logic. |
| **Terina** | Build `ChatBubble`, `ChatInput`, `TypingIndicator` components. Design the chat-to-art reveal interaction in Figma. | Polish all screens: loading skeletons, error states, empty states. Ensure the calming aesthetic is consistent. Accessibility pass (font sizes, contrast). |

**Milestone check (end of Week 6):** MindMate works. User says "I've been stressed about school" → gets empathetic reply → after 3+ turns, art auto-generates in the chat. Journal entries show emotion tags.

### Phase 4: Testing + Delivery (Weeks 7-9)

**Goal:** User testing done. Documentation complete. Demo rehearsed. Everything polished.

| Person | Week 7 | Week 8 | Week 9 |
|--------|--------|--------|--------|
| **Mohammed** | Bug fixes from user testing. Add LoginScreen + RegisterScreen. Profile screen. | Alexa support: help John test voice → chat → art flow if time allows. Final bug fixes. | Demo rehearsal. Make sure the demo flow works perfectly on a physical device. |
| **John** | Fix bugs from user testing. Add rate limiting middleware. Clean up error responses. Write API documentation. | Alexa Custom Skill (stretch): Lambda function that POSTs to `/chat` endpoint. Even a basic 60-second voice demo is impressive. | Cloud deployment (Railway/Render). Final smoke tests. Write setup instructions for `docs/`. |
| **Aahil** | Tune system prompt based on user testing feedback. Edge case testing: long conversations, unusual emotions, empty inputs. | Alexa: pair with John on voice skill. Test emotion extraction accuracy with real user test data. | Write AI architecture documentation. Prepare talking points about NLP + emotion detection for judges. |
| **Terina** | **Lead user testing: 3-5 testers.** Write test script. Collect feedback via forms. Compile insights document. | Iterate on UX based on feedback. Create presentation slides. Write 2-page project summary report (required deliverable). | Final presentation polish. Rehearse demo. Ensure all documentation is complete. |

**Final deliverables (Week 9):**
- Functional mobile prototype (R1)
- AI image generation working (R2)
- Emotion input + journaling + reflection (R3, R4)
- Emotional tagging via NLP (R5, R6)
- Calming UI/UX design (R7)
- User testing report with insights (R8)
- Architecture + API + setup documentation (R9)
- Final presentation + demo (R10)
- MindMate chatbot (Bonus)
- Alexa skill if time allows (Bonus)

---

## Concept Data (From Sponsor Brief)

These are the exact concepts, prompt templates, dropdown options, and reflection questions from the requirements document. They must be seeded into the database via `app/db/seed.py`.

| # | Concept | Prompt Template | Dropdown Options | Reflection Question |
|---|---------|----------------|-----------------|-------------------|
| A | Emotional Waves | "Create waves of [DROPDOWN] that rise and then gently fade into calm water." | worry, self-doubt, longing, overwhelm, restlessness, pressure, expectation, emotion, energy | "What helps this feeling or state soften and settle over time?" |
| B | A Safe Space | "Visualize [DROPDOWN] as a space — vast, empty, or waiting." | loneliness, grief, uncertainty, longing, emptiness, waiting, stillness, silence | "What do you wish could enter that space?" |
| C | Bright Horizon | "Show [DROPDOWN] as a bright sun emerging over the horizon." | hope, clarity, courage, joy, strength, love, possibility, renewal, resilience | "Where in your life do you feel [selected word] shining through?" |
| D | Inner Garden | "Illustrate [DROPDOWN] as a colorful garden that grows when tended." | gratitude, kindness, self-confidence, patience, love, understanding, hope, trust, creativity, self-love, commitment | "What helps this quality grow in your life?" |
| E | Harmony | "Create an image where [DROPDOWN] exist in harmony." | light and shadow, joy and sorrow, strength and vulnerability, peace and chaos, clarity and confusion, growth and rest, presence and longing | "How do you hold both [selected contrast] in your life without needing to choose one over the other?" |

Additional concepts listed in the brief (need prompt templates designed by Aahil): Resilience, Journey, Masks We Wear, Crossroads, Future Self, Bridges, Friendship, Growing Roots, Letting Go, Garden of Peace, Rising from Ashes.

## Style Options (From Sponsor Brief)

These must be seeded into the styles table and shown in the "Pick a Style" dropdown.

**Artistic Mediums:** Watercolor, Oil painting, Sketch/Pencil, Pastel, Collage, Ink/Line art

**Mood/Tone:** Dreamlike/Surreal, Abstract/Expressionist, Realistic, Minimalist, Symbolic/Archetypal, Whimsical/Playful

**Other Styles:** Cosmic/Spiritual, Mythological/Archetypal, Mandala/Sacred Geometry, Pop Art, Photorealism, Fantasy/Magical, Dark/Moody, Light/Airy

---

## Database Schema

```
┌──────────────────┐
│      users       │
├──────────────────┤
│ id         UUID PK
│ email      VARCHAR UNIQUE
│ display_name VARCHAR
│ hashed_password VARCHAR
│ preferred_style  VARCHAR NULL
│ created_at TIMESTAMP
│ updated_at TIMESTAMP
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────┐     ┌──────────────────┐     ┌──────────────────┐
│    sessions      │     │    concepts       │     │     styles       │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id        UUID PK│     │ id        UUID PK│     │ id        UUID PK│
│ user_id   FK→user│     │ title     VARCHAR│     │ name      VARCHAR│
│ concept_id FK→con│     │ slug      VARCHAR│     │ category  VARCHAR│
│ source    ENUM   │     │ prompt_template  │     │   (medium, mood, │
│  (concept/chat/  │     │ dropdown_label   │     │    other)        │
│   freeform)      │     │ dropdown_options  │     └──────────────────┘
│ created_at       │     │   JSONB          │
│ updated_at       │     │ reflection_prompt│
└──┬───────────┬───┘     │ category VARCHAR │
   │           │         └──────────────────┘
   │ 1         │ 1
   │           │
   │ N         │ N
┌──▼───────┐ ┌─▼────────────────┐
│ messages │ │ generated_images  │
├──────────┤ ├──────────────────┤
│ id    PK │ │ id          PK   │
│ session_id│ │ session_id  FK   │
│ role ENUM│ │ prompt_used      │
│ (user/   │ │ style_used       │
│  asst)   │ │ image_url VARCHAR│
│ content  │ │ thumbnail_url    │
│ emotion_ │ │ is_selected BOOL │
│  tags    │ │ source ENUM      │
│  JSONB   │ │ created_at       │
│ created_ │ └──────────┬───────┘
│  at      │            │ 1
└──────────┘            │
                        │ N (0..1 per image)
              ┌─────────▼────────┐
              │  journal_entries  │
              ├──────────────────┤
              │ id           PK  │
              │ user_id      FK  │
              │ session_id   FK  │
              │ image_id     FK  │
              │ content      TEXT│
              │ reflection_  TEXT│
              │  prompt_used     │
              │ emotion_tags     │
              │  JSONB           │
              │ word_count   INT │
              │ created_at       │
              └──────────────────┘
```

---

## Getting Started

```bash
# 1. Clone
git clone https://github.com/your-org/InnerLens.git
cd InnerLens/reflect-xr

# 2. Backend
cd reflectxr-backend
cp .env.example .env            # Fill in your real API keys
docker-compose up -d             # Starts Postgres + API + NGINX
curl http://localhost:8000/health
# → {"status": "ok", "service": "reflectxr-api"}

# 3. Run migrations + seed
docker-compose exec api alembic upgrade head
docker-compose exec api python -m app.db.seed

# 4. Frontend
cd ../reflectxr-mobile
npm install
npx expo start                   # Scan QR with Expo Go

# 5. Tests
cd ../reflectxr-backend
docker-compose exec api pytest tests/ -v
```

---

## Separation of Concerns — Module Guide Index

Each module has its own detailed guide in `docs/`. These are written for you to work independently without blocking each other.

| Guide | Owner(s) | What It Covers |
|-------|----------|---------------|
| [MODULE-1-FRONTEND.md](docs/MODULE-1-FRONTEND.md) | Mohammed + Terina | Expo setup, navigation, every screen spec, component API contracts, how to call the backend |
| [MODULE-2-BACKEND.md](docs/MODULE-2-BACKEND.md) | John | FastAPI structure, every endpoint contract (request/response), database models, S3 integration, Docker |
| [MODULE-3-AI.md](docs/MODULE-3-AI.md) | Aahil | System prompts, emotion extraction, prompt builder logic, safety module, testing AI outputs |
| [MODULE-4-MINDMATE-ALEXA.md](docs/MODULE-4-MINDMATE-ALEXA.md) | Aahil + John | MindMate chat flow, auto-generation trigger, Alexa Custom Skill setup |
| [MODULE-5-UX-TESTING.md](docs/MODULE-5-UX-TESTING.md) | Terina | Design system, Figma workflow, user testing plan, feedback form template, insights report format |

---

## Demo Script (3 minutes — for sponsors)

1. **(60s) Core flow:** Open app → tap Create → pick "Emotional Waves" → select "worry" → pick "Watercolor" → edit prompt → Submit → see 4 generated images → select one → write reflection → save. *This demonstrates R1-R7.*

2. **(60s) MindMate:** Open MindMate chat → type "I've been really stressed about school lately" → get empathetic response → continue conversation → after 3 turns, art automatically generates in the chat based on detected emotions. *This is the wow moment — art without prompting.*

3. **(30s) Journal + NLP:** Open journal history → show saved entries with emotion tags (anxiety 0.8, hope 0.4) displayed as colored chips → tap an entry to see the linked image. *Demonstrates R5, R6.*

4. **(30s) Stretch:** If Alexa works: "Alexa, open MindMate" → quick voice exchange → art generates. If not, show the architecture slide explaining how it would work.

---

## Key Decisions Log

| Decision | Chosen | Why |
|----------|--------|-----|
| Database | PostgreSQL + SQLAlchemy (not Supabase) | Full control. Demonstrates real engineering. Alembic migrations for versioned schema changes. |
| Object storage | S3-compatible (Cloudflare R2 or AWS S3) | Generated images need persistent storage. R2 has free egress. boto3 is the standard Python SDK. |
| Auth | JWT via python-jose (not Firebase/Supabase Auth) | We own the auth flow. Simpler to debug. No vendor dependency. |
| Image API | DALL-E 3 first, Stability AI fallback | DALL-E 3 is fastest to integrate. Stability gives more artistic control if we need it. |
| Chat LLM | GPT-4o | Best conversational quality for empathetic MindMate responses. Cheaper than GPT-4 Turbo. |
| Mobile framework | React Native + Expo | Cross-platform (iOS + Android as required). Mohammed has RN experience. Expo handles build config. |
| Deployment | Docker Compose (dev), Railway/Render (prod) | One command to run locally. Free tier cloud hosting for demo. |

## Authors
- Mohammed Abdur Rahman
- Aahil Shaik
- John Lizama
- Terina Ishaqzai