"""
auth.py router — Handles user registration, login, and "who am I?"

ARCHITECTURE NOTE (from MODULE-2-BACKEND docs):
"Routers are thin. They validate input (via Pydantic schemas), call a
service, and return a response. No business logic in routers."

So this file just:
1. Receives the request
2. Calls auth_service to do the work
3. Returns the result
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse
)
from app.services.auth_service import (
    register_user, authenticate_user, get_current_user
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse,
             status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create a new user account.

    - Hashes the password (never stored in plain text)
    - Creates the user row in Postgres
    - Returns a JWT token so the user is immediately logged in
    - Returns 409 if the email is already taken
    """
    token = await register_user(db, request.email, request.password, request.display_name)
    return token


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Log in with email + password.

    - Looks up the user by email
    - Verifies the password against the stored hash
    - Returns a JWT token
    - Returns 401 if credentials are wrong
    """
    token = await authenticate_user(db, request.email, request.password)
    return token


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user=Depends(get_current_user),
):
    """
    Return the currently authenticated user's profile.

    The get_current_user dependency automatically:
    1. Reads the Authorization header
    2. Decodes the JWT
    3. Looks up the user in the DB
    4. Returns the user object (or raises 401)
    """
    return current_user
