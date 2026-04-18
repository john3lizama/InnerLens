from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@db:5432/reflectxr"

    # ── Object Storage (S3-compatible: AWS S3 or Cloudflare R2) ──
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "reflectxr-images"
    S3_PUBLIC_URL: str = ""

    # ── AI Services ──────────────────────────────────────
    OPENAI_API_KEY: str = ""
    STABILITY_API_KEY: str = ""

    # Gemini (Google AI) — fallback provider for image generation when
    # OpenAI / DALL·E 3 is unavailable. Used only server-side; never
    # shipped to the mobile client. Get one at https://aistudio.google.com
    GEMINI_API_KEY: str = ""

    # ── Image-gen retry tuning ───────────────────────────
    # When both OpenAI and Gemini fail on the sync path, the request
    # escalates to a background asyncio retry (app/workers/image_retry.py).
    # The worker cycles through [OpenAI → Gemini] up to IMAGE_RETRY_CYCLES
    # times, sleeping for the Nth entry in IMAGE_RETRY_BACKOFFS between
    # cycles. Defaults: 3 cycles with 0s/30s/90s gaps (≤ ~2 min total).
    IMAGE_RETRY_CYCLES: int = 3
    IMAGE_RETRY_BACKOFFS: str = "0,30,90"  # comma-separated seconds, one per cycle

    # ── Push notifications (Expo) ────────────────────────
    # Expo's HTTP push relay — no FCM/APNs wiring needed on the backend;
    # Expo handles both platforms. Override only if you self-host Expo's
    # push service.
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"

    # ── Auth ─────────────────────────────────────────────
    JWT_SECRET: str = "dev-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # ── Email (AWS SES) ─────────────────────────────────────
    SES_SENDER_EMAIL: str = "noreply@reflectxr.app"

    # ── Alexa ─────────────────────────────────────────────
    AMAZON_SKILL_ID: str = ""
    ALEXA_DEMO_USER_ID: str = ""  # UUID of the seeded demo user for Alexa sessions

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
