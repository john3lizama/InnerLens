"""
auth.py router — Handles user registration (with email verification),
login, token refresh, profile updates, profile picture upload,
and verified email changes.

Security notes:
- Registration is two-step: request (sends code) → verify (creates account)
- Password is hashed and stored server-side in PendingRegistration — never sent twice
- Codes are generated with secrets.randbelow() (cryptographically secure)
- Code comparison uses hmac.compare_digest() (constant-time, prevents timing attacks)
- Rate limiting: max 3 code requests per email per hour
- Max 5 verification attempts per code
"""

import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.auth import (
    RegisterRequest, RegisterVerifyRequest,
    LoginRequest, UserUpdateRequest,
    EmailChangeRequest, EmailVerifyRequest, RefreshRequest,
    TokenResponse, UserResponse,
)
from app.services.auth_service import (
    hash_password, create_token_pair,
    register_user, authenticate_user, get_current_user, refresh_access_token,
)
from app.models.user import User
from app.models.pending_registration import PendingRegistration
from app.models.email_verification import EmailVerification
from app.utils.storage import upload_image
from app.services.email_service import send_verification_code
import uuid as uuid_mod

router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
CODE_EXPIRY_MINUTES = 10
MAX_VERIFY_ATTEMPTS = 5
MAX_REQUESTS_PER_HOUR = 3
MIN_PASSWORD_LENGTH = 8


def _generate_code() -> str:
    """Generate a cryptographically secure 4-digit code."""
    return f"{secrets.randbelow(10000):04d}"


def _codes_match(stored: str, submitted: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return hmac.compare_digest(stored.encode(), submitted.encode())


# ── Registration (two-step with email verification) ──────────────────────

@router.post("/register/request")
async def register_request(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: Request registration — validates input, hashes password,
    stores pending registration server-side, sends 4-digit code to email.

    The user account is NOT created yet. Password is hashed and stored
    in PendingRegistration so step 2 only needs email + code.
    """
    email = request.email.strip().lower()
    password = request.password
    display_name = request.display_name.strip()

    # ── Input validation ─────────────────────────────────────────────
    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name is required.",
        )

    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    # ── Check if email already has an account ────────────────────────
    existing_user = await db.execute(
        select(User).where(User.email == email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in.",
        )

    # ── Rate limiting: max 3 requests per email per hour ─────────────
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    rate_check = await db.execute(
        select(func.count(PendingRegistration.id)).where(
            PendingRegistration.email == email,
            PendingRegistration.created_at >= one_hour_ago,
        )
    )
    request_count = rate_check.scalar() or 0
    if request_count >= MAX_REQUESTS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait before trying again.",
        )

    # ── Clean up old pending registrations for this email ────────────
    await db.execute(
        delete(PendingRegistration).where(
            PendingRegistration.email == email,
            PendingRegistration.is_used == True,
        )
    )

    # Invalidate any active (unused) pending registrations
    active_pendings = await db.execute(
        select(PendingRegistration).where(
            PendingRegistration.email == email,
            PendingRegistration.is_used == False,
        )
    )
    for p in active_pendings.scalars().all():
        p.is_used = True

    # ── Generate code and store pending registration ─────────────────
    code = _generate_code()

    pending = PendingRegistration(
        email=email,
        display_name=display_name,
        hashed_password=hash_password(password),
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES),
    )
    db.add(pending)
    await db.commit()

    # ── Send verification code ───────────────────────────────────────
    sent = await send_verification_code(email, code)

    # Dev fallback: return code in response if SES isn't configured
    if not sent:
        print(f"[DEV] Registration verification code for {email}: {code}")
        return {"message": "Verification code sent to your email.", "dev_code": code}

    return {"message": "Verification code sent to your email."}


@router.post("/register/verify", response_model=TokenResponse,
             status_code=status.HTTP_201_CREATED)
async def register_verify(
    request: RegisterVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2: Verify the 4-digit code and create the user account.

    Retrieves the hashed password and display name from PendingRegistration
    (stored server-side in step 1). The password is never sent again.
    """
    email = request.email.strip().lower()

    # ── Find the most recent unused pending registration ─────────────
    result = await db.execute(
        select(PendingRegistration)
        .where(
            PendingRegistration.email == email,
            PendingRegistration.is_used == False,
        )
        .order_by(PendingRegistration.created_at.desc())
        .limit(1)
    )
    pending = result.scalar_one_or_none()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration found. Please request a new code.",
        )

    # ── Check expiry ─────────────────────────────────────────────────
    if datetime.utcnow() > pending.expires_at:
        pending.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code has expired. Please request a new one.",
        )

    # ── Check attempt limit ──────────────────────────────────────────
    if pending.attempts >= MAX_VERIFY_ATTEMPTS:
        pending.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new code.",
        )

    # ── Verify the code (constant-time comparison) ───────────────────
    pending.attempts += 1
    if not _codes_match(pending.code, request.code):
        await db.commit()
        remaining = MAX_VERIFY_ATTEMPTS - pending.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # ── Race condition guard: re-check email uniqueness ──────────────
    existing_user = await db.execute(
        select(User).where(User.email == email)
    )
    if existing_user.scalar_one_or_none():
        pending.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in.",
        )

    # ── Create the user from stored registration data ────────────────
    user = User(
        email=email,
        display_name=pending.display_name,
        hashed_password=pending.hashed_password,  # Already bcrypt-hashed in step 1
    )
    db.add(user)
    pending.is_used = True

    await db.commit()
    await db.refresh(user)

    return create_token_pair(user.id)


# ── Legacy register (kept for backward compatibility) ────────────────────

@router.post("/register", response_model=TokenResponse,
             status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account directly (legacy, no email verification)."""
    token = await register_user(db, request.email, request.password, request.display_name)
    return token


# ── Login & Token Refresh ────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email + password and return access + refresh tokens."""
    token = await authenticate_user(db, request.email, request.password)
    return token


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    tokens = await refresh_access_token(request.refresh_token, db)
    return tokens


# ── Profile ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    request: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update display_name and/or preferred_style."""
    if request.display_name is not None:
        current_user.display_name = request.display_name
    if request.preferred_style is not None:
        current_user.preferred_style = request.preferred_style

    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Email change (with verification code) ────────────────────────────────

@router.post("/me/request-email-change")
async def request_email_change(
    request: EmailChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Step 1: Send a verification code to the new email address."""
    new_email = request.new_email.strip().lower()

    if new_email == current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is already your current email.",
        )

    existing = await db.execute(
        select(User).where(User.email == new_email, User.id != current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already associated with another account.",
        )

    code = _generate_code()

    # Invalidate previous codes for this user
    prev_codes = await db.execute(
        select(EmailVerification).where(
            EmailVerification.user_id == current_user.id,
            EmailVerification.is_used == False,
        )
    )
    for prev in prev_codes.scalars().all():
        prev.is_used = True

    verification = EmailVerification(
        user_id=current_user.id,
        new_email=new_email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES),
    )
    db.add(verification)
    await db.commit()

    sent = await send_verification_code(new_email, code)

    if not sent:
        print(f"[DEV] Email verification code for {new_email}: {code}")
        return {"message": "Verification code sent to your new email.", "dev_code": code}

    return {"message": "Verification code sent to your new email."}


@router.post("/me/verify-email-change", response_model=UserResponse)
async def verify_email_change(
    request: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Step 2: Verify the code and apply the email change."""
    new_email = request.new_email.strip().lower()

    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == current_user.id,
            EmailVerification.new_email == new_email,
            EmailVerification.is_used == False,
        )
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending verification found. Please request a new code.",
        )

    if datetime.utcnow() > verification.expires_at:
        verification.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code has expired. Please request a new one.",
        )

    if verification.attempts >= MAX_VERIFY_ATTEMPTS:
        verification.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new code.",
        )

    verification.attempts += 1
    if not _codes_match(verification.code, request.code):
        await db.commit()
        remaining = MAX_VERIFY_ATTEMPTS - verification.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # Re-check email availability (race condition guard)
    existing = await db.execute(
        select(User).where(User.email == new_email, User.id != current_user.id)
    )
    if existing.scalar_one_or_none():
        verification.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already associated with another account.",
        )

    verification.is_used = True
    current_user.email = new_email
    await db.commit()
    await db.refresh(current_user)

    return current_user


# ── Profile image upload ─────────────────────────────────────────────────

@router.post("/me/profile-image", response_model=UserResponse)
async def upload_profile_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload or replace the user's profile picture (JPEG/PNG/WebP, max 5 MB)."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a JPEG, PNG, or WebP image.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large. Maximum size is 5 MB.",
        )

    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    ext = ext_map.get(file.content_type, "png")

    short_id = uuid_mod.uuid4().hex[:8]
    s3_key = f"profiles/{current_user.id}/profile-{short_id}.{ext}"
    image_url = await upload_image(file_bytes, s3_key, content_type=file.content_type)

    current_user.profile_image_url = image_url
    await db.commit()
    await db.refresh(current_user)

    return current_user
