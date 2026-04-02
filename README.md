# InnerLens — ReflectXR + MindMate

**Title:** *Developing an Emotion-Based Generative AI Mobile Experience for Arts & Wellness*

**Sponsor:** Persistent Technology, Inc.

**Timeline:** 8 weeks.

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

| Layer | Technology | Why |
|-------|-----------|-----|
| Mobile app | React Native + Expo + TypeScript | Cross-platform from one codebase. Mohammed has iOS/RN experience. Expo handles builds. |
| Backend API | FastAPI (Python 3.11) | Async-native, auto-generates OpenAPI docs, Python ecosystem for AI libs. John owns this. |
| Database | PostgreSQL 16 (Docker) | Industry standard RDBMS. Full control via SQLAlchemy ORM + Alembic migrations. |
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

---

## Project Structure

```
InnerLens/
├── README.md
├── LICENSE
├── reflect-xr/
│   ├── reflectxr-backend/
│   │   ├── app/
│   │   │   ├── main.py                    # FastAPI entry point, CORS, router mounts
│   │   │   ├── config.py                  # Pydantic settings (DB, S3, OpenAI, JWT)
│   │   │   ├── routers/                   # HTTP layer (thin — delegates to services)
│   │   │   ├── services/                  # Business logic (testable, no HTTP deps)
│   │   │   ├── ai/                        # AI configuration (prompts, safety, maps)
│   │   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── db/                        # Database connection + seed data
│   │   │   └── utils/                     # Shared helpers
│   │   ├── alembic/                       # DB migrations
│   │   ├── nginx/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── requirements.txt
│   │   └── .env.example
│   │
│   └── reflectxr-mobile/
│       └── src/
│           ├── screens/                   # One file per screen, grouped by flow
│           │   ├── auth/                  # LoginScreen, RegisterScreen
│           │   ├── home/                  # HomeScreen
│           │   ├── create/                # Concepts → PromptDesign → PromptEdit → Response → Reflect
│           │   ├── chat/                  # MindMate (ChatScreen, ChatImageReveal)
│           │   ├── journal/               # JournalListScreen, JournalDetailScreen
│           │   └── profile/               # ProfileScreen
│           ├── components/                # Reusable UI atoms (ui/, chat/, create/, journal/)
│           ├── navigation/                # React Navigation setup
│           ├── hooks/                     # useAuth, useChat, useConcepts
│           ├── context/                   # AuthContext, ThemeContext
│           ├── theme/                     # colors, typography, spacing
│           ├── types/                     # TypeScript interfaces
│           └── utils/                     # formatDate, emotionColors
│
└── docs/                                  # Deliverable documentation
    ├── MODULE-1-FRONTEND.md
    ├── MODULE-2-BACKEND.md
    ├── MODULE-3-AI.md
    ├── MODULE-4-MINDMATE-ALEXA.md
    ├── MODULE-5-UX-TESTING.md
    ├── user-testing/
    └── presentation/
```

See `docs/` for detailed module guides (frontend, backend, AI, MindMate, UX/testing).

---

## Team

| Name | Role | Responsibilities |
|------|------|-----------------|
| Mohammed Abdur Rahman | Mobile App Development | React Native (Expo), cross-platform iOS/Android, NLP/emotion tagging, documentation |
| John Lizama | Backend Development | FastAPI, PostgreSQL, Docker, NGINX, authentication, AWS S3 storage |
| Aahil Shaik | AI/ML Integration | OpenAI DALL-E 3 integration, prompt engineering, content guardrails (Moderation API + Rekognition) |
| Terina Ishaqzai | UI/UX Design | User flows, wireframes, screen design, graphic design (icon, typography, color system) |

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

## Authors
- Mohammed Abdur Rahman
- Aahil Shaik
- John Lizama
- Terina Ishaqzai
