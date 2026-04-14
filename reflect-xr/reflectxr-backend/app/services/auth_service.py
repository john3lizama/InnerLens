"""
auth_service.py — Registration, login, password hashing, and JWT tokens.

This is where the actual auth logic lives. The router (routers/auth.py)
is just a thin wrapper that calls these functions.

TOKEN STRATEGY:
- Access token: short-lived (30 minutes), used for API requests
- Refresh token: long-lived (30 days), used only to get new access tokens
- On login/register, both tokens are issued
- Client stores both in AsyncStorage (access) and secure storage (refresh)
- When access token expires, client uses refresh token to silently get a new one

SECURITY NOTES:
- Passwords are hashed with bcrypt (one-way hash — can't be reversed)
- The get_current_user dependency is used by every protected route
"""

import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.db.database import get_db
from app.models.user import User

# ── Password hashing setup ───────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 scheme ────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Token durations ──────────────────────────────────────────────────────
ACCESS_TOKEN_MINUTES = 30
REFRESH_TOKEN_DAYS = 30


def hash_password(password: str) -> str:
    """Hash a plain-text password. Used during registration."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain-text password matches a hash. Used during login."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: uuid.UUID) -> str:
    """
    Create a short-lived access token (30 minutes).
    Used for authenticating API requests.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    """
    Create a long-lived refresh token (30 days).
    Used only to obtain new access tokens without re-entering credentials.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_token_pair(user_id: uuid.UUID) -> dict:
    """Create both access and refresh tokens."""
    return {
        "access_token": create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
    }


async def register_user(
    db: AsyncSession, email: str, password: str, display_name: str
) -> dict:
    """
    Create a new user account. Returns access + refresh tokens.
    Raises 409 if the email is already registered.
    """
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=email,
        display_name=display_name,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return create_token_pair(user.id)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> dict:
    """
    Verify email + password. Returns access + refresh tokens.
    Raises 401 if the credentials are wrong.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return create_token_pair(user.id)


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> dict:
    """
    Validate a refresh token and issue a new access + refresh token pair.
    This is called when the access token has expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    try:
        payload = jwt.decode(
            refresh_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Verify the user still exists
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Issue a fresh token pair (token rotation for security)
    return create_token_pair(user.id)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — decodes the JWT and returns the User object.

    Used like this in any protected route:
        current_user = Depends(get_current_user)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "access")

        if user_id is None:
            raise credentials_exception

        # Reject refresh tokens used as access tokens
        if token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user
