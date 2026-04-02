"""
auth_service.py — Registration, login, password hashing, and JWT tokens.

This is where the actual auth logic lives. The router (routers/auth.py)
is just a thin wrapper that calls these functions.

SECURITY NOTES:
- Passwords are hashed with bcrypt (one-way hash — can't be reversed)
- JWTs expire after 24 hours (configurable in config.py)
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
# CryptContext handles hashing and verification. bcrypt is the algorithm.
# "deprecated='auto'" means old hash formats are auto-upgraded on verify.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 scheme ────────────────────────────────────────────────────────
# Tells FastAPI to look for a Bearer token in the Authorization header.
# tokenUrl is just for documentation/Swagger UI — it's the login endpoint.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """Hash a plain-text password. Used during registration."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain-text password matches a hash. Used during login."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: uuid.UUID) -> str:
    """
    Create a JWT token with the user's ID and an expiration time.

    The token payload looks like:
    { "sub": "user-uuid-here", "exp": 1234567890 }

    "sub" = subject (who this token is for)
    "exp" = expiration timestamp (after this, the token is rejected)
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRATION_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def register_user(
    db: AsyncSession, email: str, password: str, display_name: str
) -> dict:
    """
    Create a new user account. Returns a JWT token.

    Raises 409 if the email is already registered.
    """
    # Check if email is already taken
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create the user with a hashed password
    user = User(
        email=email,
        display_name=display_name,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Return a token so the user is immediately logged in
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


async def authenticate_user(db: AsyncSession, email: str, password: str) -> dict:
    """
    Verify email + password. Returns a JWT token.

    Raises 401 if the credentials are wrong.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — decodes the JWT and returns the User object.

    Used like this in any protected route:
        current_user = Depends(get_current_user)

    If the token is missing, expired, or invalid, raises 401 automatically.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode the JWT
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Look up the user in the database
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user
