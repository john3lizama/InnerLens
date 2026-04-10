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

    # ── Auth ─────────────────────────────────────────────
    JWT_SECRET: str = "dev-secret-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # ── Alexa ─────────────────────────────────────────────
    AMAZON_SKILL_ID: str = ""
    ALEXA_DEMO_USER_ID: str = ""  # UUID of the seeded demo user for Alexa sessions

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
