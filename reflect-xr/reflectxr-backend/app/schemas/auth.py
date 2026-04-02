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


# ── Response schemas (what the API returns) ──────────────────────────────

class TokenResponse(BaseModel):
    """Returned after successful register or login."""
    access_token: str
    token_type: str = "bearer"    # Always "bearer" for JWT auth


class UserResponse(BaseModel):
    """GET /auth/me — The current user's profile."""
    id: UUID
    email: str
    display_name: str
    preferred_style: str | None
    created_at: datetime

    # model_config tells Pydantic to read data from SQLAlchemy model attributes.
    # Without this, it can't convert a User ORM object into a JSON response.
    model_config = {"from_attributes": True}
