# Module 2 — Backend API (FastAPI + PostgreSQL)

**Owner:** John
**Location:** `reflect-xr/reflectxr-backend/`

---

## 1. Architecture Principles

**Routers are thin.** They validate input (via Pydantic schemas), call a service, and return a response. No business logic in routers.

**Services are testable.** They accept plain Python arguments, not Request objects. They can be unit tested without spinning up FastAPI.

**Models are the source of truth.** SQLAlchemy models define the schema. Alembic migrations keep the DB in sync.

---

## 2. Startup Checklist

```bash
cd reflectxr-backend
cp .env.example .env          # Fill in real values
docker-compose up -d           # Starts Postgres + API + NGINX
docker-compose logs -f api     # Watch for startup errors

# First-time setup
docker-compose exec api alembic upgrade head     # Run migrations
docker-compose exec api python -m app.db.seed    # Seed concepts + styles

# Verify
curl http://localhost:8000/health
curl http://localhost:8000/concepts
```

---

## 3. Endpoint Contract (Complete)

Every endpoint, its method, request body, response shape, and auth requirement. Mohammed's frontend is coded against this contract.

### Auth Router (`/auth`)

**POST /auth/register**
```
Request:  { "email": str, "password": str, "display_name": str }
Response: { "access_token": str, "token_type": "bearer" }
Errors:   409 if email already exists
```

**POST /auth/login**
```
Request:  { "email": str, "password": str }
Response: { "access_token": str, "token_type": "bearer" }
Errors:   401 if invalid credentials
```

**GET /auth/me** (requires Bearer token)
```
Response: { "id": uuid, "email": str, "display_name": str, "preferred_style": str|null, "created_at": str }
Errors:   401 if token invalid/expired
```

### Concepts Router (`/concepts`)

**GET /concepts**
```
Response: {
  "concepts": [
    {
      "id": uuid,
      "title": "Emotional Waves",
      "slug": "emotional-waves",
      "prompt_template": "Create waves of [DROPDOWN] that rise and then gently fade into calm water.",
      "dropdown_label": "Pick an Emotion",
      "dropdown_options": ["worry", "self-doubt", "longing", ...],
      "reflection_prompt": "What helps this feeling or state soften and settle over time?",
      "category": "core"
    },
    ...
  ]
}
```

**GET /styles**
```
Response: {
  "styles": [
    { "id": uuid, "name": "Watercolor", "category": "medium" },
    { "id": uuid, "name": "Dreamlike / Surreal", "category": "mood" },
    ...
  ]
}
```

### Generate Router (`/generate`)

**POST /generate** (requires auth)
```
Request:  { "prompt": str, "style": str, "concept_id": uuid, "count": int (default 4) }
Response: {
  "session_id": uuid,
  "images": [
    { "id": uuid, "image_url": str, "thumbnail_url": str, "prompt_used": str, "style_used": str },
    ...
  ]
}
```
Implementation: Creates a session → calls `image_service.generate()` N times → uploads to S3 → stores records → returns URLs.

**POST /generate/select** (requires auth)
```
Request:  { "image_id": uuid, "session_id": uuid }
Response: { "status": "ok", "image_id": uuid }
```
Implementation: Sets `is_selected=true` on the chosen image, `is_selected=false` on siblings in same session.

### Chat Router (`/chat`)

**POST /chat** (requires auth)
```
Request:  { "session_id": uuid|null, "message": str }
Response: {
  "session_id": uuid,
  "reply": str,
  "emotion_tags": [{ "emotion": str, "intensity": float }],
  "mode_detected": "check-in"|"grounding"|"reflection",
  "should_generate_image": bool,
  "is_crisis": bool
}
```
Implementation: If `session_id` is null, create a new session with `source="chat"`. Run crisis check first. If safe, build LLM context from last 5 messages + system prompt → call GPT-4o → extract emotions → check if auto-generation should trigger → return.

**POST /chat/generate-from-conversation** (requires auth)
```
Request:  { "session_id": uuid }
Response: {
  "image": { "id": uuid, "image_url": str, "prompt_used": str, "style_used": str },
  "emotion_summary": [{ "emotion": str, "intensity": float }]
}
```
Implementation: Read session messages → extract emotions → call prompt_builder → generate image → upload to S3 → return.

### Journal Router (`/journal`)

**POST /journal** (requires auth)
```
Request:  { "image_id": uuid, "session_id": uuid, "content": str, "reflection_prompt_used": str|null }
Response: { "id": uuid, "created_at": str, "emotion_tags": [...], "word_count": int }
```
Implementation: Save entry → run emotion_service on content → store tags → calculate word_count.

**GET /journal** (requires auth)
```
Query params: limit (default 20), offset (default 0)
Response: {
  "entries": [
    { "id": uuid, "content": str (truncated 100 chars), "emotion_tags": [...],
      "image": { "id": uuid, "thumbnail_url": str }, "created_at": str, "word_count": int },
    ...
  ],
  "total": int
}
```

**GET /journal/:id** (requires auth)
```
Response: {
  "id": uuid, "content": str, "emotion_tags": [...],
  "image": { "id": uuid, "image_url": str, "thumbnail_url": str },
  "reflection_prompt_used": str|null, "created_at": str, "word_count": int
}
```

---

## 4. Database Models

Each model in `app/models/` should use SQLAlchemy 2.0 `Mapped` syntax. Example pattern:

```python
from sqlalchemy import String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    preferred_style: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
```

Follow this pattern for all 7 models. See the schema diagram in the README.

---

## 5. Seed Data (`app/db/seed.py`)

This script must populate:
- All 16 concepts from the brief (5 with full templates from the doc, 11 that Aahil will design templates for)
- All 20 styles grouped by category (medium, mood, other)

Run it with: `docker-compose exec api python -m app.db.seed`
Make it idempotent (check if data exists before inserting).

---

## 6. S3/R2 Storage (`app/utils/storage.py`)

```python
import boto3
from app.config import settings

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
)

async def upload_image(file_bytes: bytes, key: str) -> str:
    """Upload image bytes to S3. Returns the public URL."""
    s3_client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType="image/png",
    )
    return f"{settings.S3_PUBLIC_URL}/{key}"
```

Image keys follow the pattern: `generated/{session_id}/{image_id}.png`
Thumbnails: `thumbnails/{session_id}/{image_id}.png`

---

## 7. Auth Flow (`app/services/auth_service.py`)

- Hash passwords with passlib bcrypt
- Issue JWTs with python-jose (payload: `{ "sub": user_id, "exp": now + 24h }`)
- Create a `get_current_user` dependency that decodes the Bearer token and returns the user
- Use this dependency on every protected endpoint

---

## 8. Testing

Write tests in `tests/` using pytest-asyncio. At minimum:

- `test_auth.py`: register → login → get me → verify token
- `test_concepts.py`: get concepts returns seeded data with correct shape
- `test_generate.py`: mock the AI API, verify image records are created
- `test_chat.py`: mock GPT response, verify session creation, crisis detection

Use `conftest.py` to set up a test database and create fixtures.
