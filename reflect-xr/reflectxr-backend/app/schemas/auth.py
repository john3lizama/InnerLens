"""
auth.py schemas — Validates data going in/out of the /auth endpoints.

WHAT ARE SCHEMAS?
Pydantic schemas are separate from SQLAlchemy models. Models define the database
table. Schemas define what the API accepts (Request) and returns (Response).

WHY SEPARATE?
- You never want to expose hashed_password in an API response
- Request bodies often have different fields than the database row
- Schemas validate input automatically — if someone sends bad data, FastAPI
  returns a 422 error before your code even runs
"""

from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime


# ── Request schemas (what the client sends) ──────────────────────────────

class RegisterRequest(BaseModel):
    """POST /auth/register — Create a new account."""
    email: EmailStr          # Pydantic validates this is a real email format
    password: str            # Plain text — we hash it in auth_service.py
    display_name: str


class LoginRequest(BaseModel):
    """POST /auth/login — Get a JWT token."""
    email: EmailStr
    password: str


class UserUpdateRequest(BaseModel):
    """PATCH /auth/me — Update profile fields (except email, which uses verification flow)."""
    display_name: str | None = None
    preferred_style: str | None = None


class RegisterVerifyRequest(BaseModel):
    """POST /auth/register/verify — Verify email with 4-digit code to complete registration."""
    email: EmailStr
    code: str


class EmailChangeRequest(BaseModel):
    """POST /auth/me/request-email-change — Initiate email change."""
    new_email: EmailStr


class EmailVerifyRequest(BaseModel):
    """POST /auth/me/verify-email-change — Confirm with 4-digit code."""
    new_email: EmailStr
    code: str


# ── Response schemas (what the API returns) ──────────────────────────────

class RefreshRequest(BaseModel):
    """POST /auth/refresh — Exchange a refresh token for new tokens."""
    refresh_token: str


class TokenResponse(BaseModel):
    """Returned after successful register, login, or refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """GET /auth/me — The current user's profile."""
    id: UUID
    email: str
    display_name: str
    preferred_style: str | None
    profile_image_url: str | None = None
    created_at: datetime

    # model_config tells Pydantic to read data from SQLAlchemy model attributes.
    # Without this, it can't convert a User ORM object into a JSON response.
    model_config = {"from_attributes": True}
