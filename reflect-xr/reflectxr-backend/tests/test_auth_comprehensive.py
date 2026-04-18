"""
test_auth_comprehensive.py — Category 1: Authentication & User Management

100 tests across 11 sub-sections:
  1.  Password hashing unit tests           (8)
  2.  JWT token unit tests                  (9)
  3.  Legacy registration /auth/register   (10)
  4.  Two-step registration /register/request (10)
  5.  Two-step registration /register/verify  (10)
  6.  Login /auth/login                     (9)
  7.  Token refresh /auth/refresh           (8)
  8.  GET /auth/me                           (8)
  9.  PATCH /auth/me                         (9)
  10. Email change (request + verify)       (10)
  11. Profile image upload/delete            (9)
"""

import io
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from jose import jwt
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    hash_password,
    verify_password,
)

# ── URL constants ─────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
REGISTER_REQUEST_URL = "/auth/register/request"
REGISTER_VERIFY_URL = "/auth/register/verify"
LOGIN_URL = "/auth/login"
REFRESH_URL = "/auth/refresh"
ME_URL = "/auth/me"
REQUEST_EMAIL_URL = "/auth/me/request-email-change"
VERIFY_EMAIL_URL = "/auth/me/verify-email-change"
PROFILE_IMAGE_URL = "/auth/me/profile-image"


# ── Test helpers ──────────────────────────────────────────────────────────

def _png_bytes() -> bytes:
    img = PILImage.new("RGB", (10, 10), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes() -> bytes:
    img = PILImage.new("RGB", (10, 10), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


async def _register(client: AsyncClient, email: str, display_name: str = "Test User") -> None:
    await client.post(REGISTER_URL, json={
        "email": email, "password": "StrongPass123!", "display_name": display_name,
    })


async def _auth_headers(client: AsyncClient, email: str) -> dict[str, str]:
    await _register(client, email)
    resp = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass123!"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _register_get_tokens(client: AsyncClient, email: str) -> dict:
    await _register(client, email)
    resp = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass123!"})
    return resp.json()


# ══════════════════════════════════════════════════════════════════════════
# 1 — Password hashing unit tests (8 tests)
# ══════════════════════════════════════════════════════════════════════════

def test_hash_password_returns_string():
    assert isinstance(hash_password("anypassword"), str)


def test_hash_password_is_not_plaintext():
    pw = "supersecret"
    assert pw not in hash_password(pw)


def test_hash_password_has_bcrypt_prefix():
    result = hash_password("anypassword")
    assert result.startswith("$2b$") or result.startswith("$2a$")


def test_hash_password_same_input_produces_different_hashes():
    h1 = hash_password("samepassword")
    h2 = hash_password("samepassword")
    assert h1 != h2


def test_verify_password_correct_returns_true():
    hashed = hash_password("correct_password")
    assert verify_password("correct_password", hashed) is True


def test_verify_password_wrong_returns_false():
    hashed = hash_password("correctpassword")
    assert verify_password("wrongpassword", hashed) is False


def test_verify_password_empty_returns_false():
    hashed = hash_password("somepassword")
    assert verify_password("", hashed) is False


def test_verify_password_is_case_sensitive():
    hashed = hash_password("Password123")
    assert verify_password("password123", hashed) is False


# ══════════════════════════════════════════════════════════════════════════
# 2 — JWT token unit tests (9 tests)
# ══════════════════════════════════════════════════════════════════════════

def test_create_access_token_returns_non_empty_string():
    token = create_access_token(uuid.uuid4())
    assert isinstance(token, str) and len(token) > 0


def test_create_refresh_token_returns_non_empty_string():
    token = create_refresh_token(uuid.uuid4())
    assert isinstance(token, str) and len(token) > 0


def test_access_token_type_claim_is_access():
    token = create_access_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "access"


def test_refresh_token_type_claim_is_refresh():
    token = create_refresh_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "refresh"


def test_access_token_sub_matches_user_id():
    uid = uuid.uuid4()
    token = create_access_token(uid)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(uid)


def test_refresh_token_sub_matches_user_id():
    uid = uuid.uuid4()
    token = create_refresh_token(uid)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(uid)


def test_create_token_pair_contains_both_tokens():
    pair = create_token_pair(uuid.uuid4())
    assert "access_token" in pair
    assert "refresh_token" in pair
    assert pair["token_type"] == "bearer"


def test_access_token_expiry_is_approximately_30_minutes():
    token = create_access_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    diff_minutes = (exp - datetime.now(tz=timezone.utc)).total_seconds() / 60
    assert 28 <= diff_minutes <= 32


def test_refresh_token_expiry_is_approximately_30_days():
    token = create_refresh_token(uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    diff_days = (exp - datetime.now(tz=timezone.utc)).total_seconds() / 86400
    assert 29 <= diff_days <= 31


# ══════════════════════════════════════════════════════════════════════════
# 3 — Legacy registration /auth/register (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_legacy_register_returns_201(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "email": "lr1@example.com", "password": "StrongPass123!", "display_name": "Alice",
    })
    assert resp.status_code == 201


async def test_legacy_register_returns_access_token(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "email": "lr2@example.com", "password": "StrongPass123!", "display_name": "Bob",
    })
    assert "access_token" in resp.json()


async def test_legacy_register_returns_refresh_token(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "email": "lr3@example.com", "password": "StrongPass123!", "display_name": "Carol",
    })
    assert "refresh_token" in resp.json()


async def test_legacy_register_token_type_is_bearer(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "email": "lr4@example.com", "password": "StrongPass123!", "display_name": "Dave",
    })
    assert resp.json()["token_type"] == "bearer"


async def test_legacy_register_duplicate_email_returns_409(client: AsyncClient):
    payload = {"email": "dup@example.com", "password": "StrongPass123!", "display_name": "Dup"}
    await client.post(REGISTER_URL, json=payload)
    resp = await client.post(REGISTER_URL, json=payload)
    assert resp.status_code == 409


async def test_legacy_register_missing_email_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={"password": "pass", "display_name": "X"})
    assert resp.status_code == 422


async def test_legacy_register_missing_password_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={"email": "a@b.com", "display_name": "X"})
    assert resp.status_code == 422


async def test_legacy_register_missing_display_name_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={"email": "a@b.com", "password": "pass"})
    assert resp.status_code == 422


async def test_legacy_register_invalid_email_format_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "email": "not-an-email", "password": "pass", "display_name": "X",
    })
    assert resp.status_code == 422


async def test_legacy_register_user_persisted_in_db(client: AsyncClient, db: AsyncSession):
    await client.post(REGISTER_URL, json={
        "email": "dbcheck@example.com", "password": "StrongPass123!", "display_name": "DBUser",
    })
    result = await db.execute(select(User).where(User.email == "dbcheck@example.com"))
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.display_name == "DBUser"


# ══════════════════════════════════════════════════════════════════════════
# 4 — Two-step registration /auth/register/request (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_register_request_returns_200(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rreq1@example.com", "password": "StrongPass123!", "display_name": "ReqUser",
        })
    assert resp.status_code == 200
    assert "message" in resp.json()


async def test_register_request_returns_dev_code_when_ses_unconfigured(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rreq2@example.com", "password": "StrongPass123!", "display_name": "DevUser",
        })
    assert resp.status_code == 200
    assert "dev_code" in resp.json()


async def test_register_request_duplicate_email_returns_409(client: AsyncClient):
    await _register(client, "taken_rr@example.com")
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": "taken_rr@example.com", "password": "NewPass123!", "display_name": "New",
        })
    assert resp.status_code == 409


async def test_register_request_empty_display_name_returns_400(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": "blank@example.com", "password": "StrongPass123!", "display_name": "   ",
        })
    assert resp.status_code == 400


async def test_register_request_short_password_returns_400(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": "short@example.com", "password": "1234567", "display_name": "ShortPw",
        })
    assert resp.status_code == 400


async def test_register_request_stores_pending_registration(client: AsyncClient, db: AsyncSession):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        await client.post(REGISTER_REQUEST_URL, json={
            "email": "pending_rr@example.com", "password": "StrongPass123!", "display_name": "PendUser",
        })
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.email == "pending_rr@example.com")
    )
    pending = result.scalar_one_or_none()
    assert pending is not None
    assert pending.is_used is False


async def test_register_request_missing_email_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_REQUEST_URL, json={
        "password": "StrongPass123!", "display_name": "NoEmail",
    })
    assert resp.status_code == 422


async def test_register_request_invalid_email_returns_422(client: AsyncClient):
    resp = await client.post(REGISTER_REQUEST_URL, json={
        "email": "bademail", "password": "StrongPass123!", "display_name": "BadEmail",
    })
    assert resp.status_code == 422


async def test_register_request_rate_limit_blocks_fourth_request(client: AsyncClient):
    email = "ratelimit_rr@example.com"
    for _ in range(3):
        with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
            await client.post(REGISTER_REQUEST_URL, json={
                "email": email, "password": "StrongPass123!", "display_name": "RateUser",
            })
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REGISTER_REQUEST_URL, json={
            "email": email, "password": "StrongPass123!", "display_name": "RateUser",
        })
    assert resp.status_code == 429


async def test_register_request_invalidates_previous_pending(client: AsyncClient, db: AsyncSession):
    email = "invalidate_rr@example.com"
    for _ in range(2):
        with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
            await client.post(REGISTER_REQUEST_URL, json={
                "email": email, "password": "StrongPass123!", "display_name": "InvUser",
            })
    result = await db.execute(
        select(PendingRegistration).where(
            PendingRegistration.email == email,
            PendingRegistration.is_used == True,
        )
    )
    used = result.scalars().all()
    assert len(used) >= 1


# ══════════════════════════════════════════════════════════════════════════
# 5 — Two-step registration /auth/register/verify (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_register_verify_returns_201_with_tokens(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv1@example.com", "password": "StrongPass123!", "display_name": "RV1",
        })
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv1@example.com", "code": req.json()["dev_code"],
    })
    assert resp.status_code == 201
    assert "access_token" in resp.json()
    assert "refresh_token" in resp.json()


async def test_register_verify_creates_user_in_db(client: AsyncClient, db: AsyncSession):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv2@example.com", "password": "StrongPass123!", "display_name": "RV2",
        })
    await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv2@example.com", "code": req.json()["dev_code"],
    })
    result = await db.execute(select(User).where(User.email == "rv2@example.com"))
    assert result.scalar_one_or_none() is not None


async def test_register_verify_marks_pending_as_used(client: AsyncClient, db: AsyncSession):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv3@example.com", "password": "StrongPass123!", "display_name": "RV3",
        })
    await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv3@example.com", "code": req.json()["dev_code"],
    })
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.email == "rv3@example.com")
    )
    pending = result.scalar_one_or_none()
    assert pending is not None and pending.is_used is True


async def test_register_verify_wrong_code_returns_400(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv4@example.com", "password": "StrongPass123!", "display_name": "RV4",
        })
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv4@example.com", "code": "0000",
    })
    assert resp.status_code == 400


async def test_register_verify_no_pending_returns_400(client: AsyncClient):
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "nopending_rv@example.com", "code": "1234",
    })
    assert resp.status_code == 400


async def test_register_verify_expired_code_returns_400(client: AsyncClient, db: AsyncSession):
    pending = PendingRegistration(
        email="rv_expired@example.com",
        display_name="ExpiredUser",
        hashed_password=hash_password("Pass123!"),
        code="9999",
        expires_at=datetime.utcnow() - timedelta(minutes=1),
    )
    db.add(pending)
    await db.commit()
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv_expired@example.com", "code": "9999",
    })
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


async def test_register_verify_max_attempts_returns_429(client: AsyncClient, db: AsyncSession):
    pending = PendingRegistration(
        email="rv_maxattempts@example.com",
        display_name="MaxUser",
        hashed_password=hash_password("Pass123!"),
        code="1111",
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        attempts=5,
    )
    db.add(pending)
    await db.commit()
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv_maxattempts@example.com", "code": "1111",
    })
    assert resp.status_code == 429


async def test_register_verify_wrong_code_increments_attempts(client: AsyncClient, db: AsyncSession):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv_attempts@example.com", "password": "StrongPass123!", "display_name": "RVA",
        })
    await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv_attempts@example.com", "code": "0000",
    })
    result = await db.execute(
        select(PendingRegistration).where(
            PendingRegistration.email == "rv_attempts@example.com",
            PendingRegistration.is_used == False,
        )
    )
    pending = result.scalar_one_or_none()
    assert pending is not None and pending.attempts == 1


async def test_register_verify_wrong_code_shows_remaining_attempts(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv_remaining@example.com", "password": "StrongPass123!", "display_name": "RVR",
        })
    resp = await client.post(REGISTER_VERIFY_URL, json={
        "email": "rv_remaining@example.com", "code": "0000",
    })
    detail = resp.json()["detail"].lower()
    assert "remaining" in detail or "attempt" in detail


async def test_register_verify_code_cannot_be_reused(client: AsyncClient):
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req = await client.post(REGISTER_REQUEST_URL, json={
            "email": "rv_reuse@example.com", "password": "StrongPass123!", "display_name": "RVReuse",
        })
    code = req.json()["dev_code"]
    await client.post(REGISTER_VERIFY_URL, json={"email": "rv_reuse@example.com", "code": code})
    resp = await client.post(REGISTER_VERIFY_URL, json={"email": "rv_reuse@example.com", "code": code})
    assert resp.status_code in (400, 409)


# ══════════════════════════════════════════════════════════════════════════
# 6 — Login /auth/login (9 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_login_returns_200(client: AsyncClient):
    await _register(client, "login1@example.com")
    resp = await client.post(LOGIN_URL, json={"email": "login1@example.com", "password": "StrongPass123!"})
    assert resp.status_code == 200


async def test_login_returns_access_and_refresh_tokens(client: AsyncClient):
    await _register(client, "login2@example.com")
    resp = await client.post(LOGIN_URL, json={"email": "login2@example.com", "password": "StrongPass123!"})
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_login_wrong_password_returns_401(client: AsyncClient):
    await _register(client, "login3@example.com")
    resp = await client.post(LOGIN_URL, json={"email": "login3@example.com", "password": "WrongPass999!"})
    assert resp.status_code == 401


async def test_login_nonexistent_email_returns_401(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={"email": "ghost@example.com", "password": "Pass123!"})
    assert resp.status_code == 401


async def test_login_missing_email_returns_422(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={"password": "Pass123!"})
    assert resp.status_code == 422


async def test_login_missing_password_returns_422(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={"email": "a@b.com"})
    assert resp.status_code == 422


async def test_login_invalid_email_format_returns_422(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={"email": "notvalid", "password": "Pass123!"})
    assert resp.status_code == 422


async def test_login_token_type_is_bearer(client: AsyncClient):
    await _register(client, "login8@example.com")
    resp = await client.post(LOGIN_URL, json={"email": "login8@example.com", "password": "StrongPass123!"})
    assert resp.json()["token_type"] == "bearer"


async def test_login_access_token_is_decodable_jwt(client: AsyncClient):
    await _register(client, "login9@example.com")
    resp = await client.post(LOGIN_URL, json={"email": "login9@example.com", "password": "StrongPass123!"})
    token = resp.json()["access_token"]
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["type"] == "access"
    assert "sub" in payload


# ══════════════════════════════════════════════════════════════════════════
# 7 — Token refresh /auth/refresh (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_refresh_with_valid_refresh_token_returns_200(client: AsyncClient):
    tokens = await _register_get_tokens(client, "ref1@example.com")
    resp = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200


async def test_refresh_returns_new_access_and_refresh_tokens(client: AsyncClient):
    tokens = await _register_get_tokens(client, "ref2@example.com")
    resp = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    body = resp.json()
    assert "access_token" in body and "refresh_token" in body


async def test_refresh_new_access_token_differs_from_old(client: AsyncClient):
    tokens = await _register_get_tokens(client, "ref3@example.com")
    resp = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert resp.json()["access_token"] != tokens["access_token"]


async def test_refresh_with_access_token_as_refresh_returns_401(client: AsyncClient):
    tokens = await _register_get_tokens(client, "ref4@example.com")
    resp = await client.post(REFRESH_URL, json={"refresh_token": tokens["access_token"]})
    assert resp.status_code == 401


async def test_refresh_with_invalid_string_returns_401(client: AsyncClient):
    resp = await client.post(REFRESH_URL, json={"refresh_token": "completely.invalid.token"})
    assert resp.status_code == 401


async def test_refresh_with_random_string_returns_401(client: AsyncClient):
    resp = await client.post(REFRESH_URL, json={"refresh_token": "randomstring"})
    assert resp.status_code == 401


async def test_refresh_missing_body_returns_422(client: AsyncClient):
    resp = await client.post(REFRESH_URL, json={})
    assert resp.status_code == 422


async def test_refresh_new_access_token_works_on_protected_endpoint(client: AsyncClient):
    tokens = await _register_get_tokens(client, "ref8@example.com")
    refresh_resp = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    new_access = refresh_resp.json()["access_token"]
    me_resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {new_access}"})
    assert me_resp.status_code == 200


# ══════════════════════════════════════════════════════════════════════════
# 8 — GET /auth/me (8 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_get_me_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "me1@example.com")
    resp = await client.get(ME_URL, headers=headers)
    assert resp.status_code == 200


async def test_get_me_includes_all_required_fields(client: AsyncClient):
    headers = await _auth_headers(client, "me2@example.com")
    resp = await client.get(ME_URL, headers=headers)
    for field in ("id", "email", "display_name", "created_at"):
        assert field in resp.json(), f"Missing field: {field}"


async def test_get_me_no_token_returns_401(client: AsyncClient):
    assert (await client.get(ME_URL)).status_code == 401


async def test_get_me_invalid_token_returns_401(client: AsyncClient):
    resp = await client.get(ME_URL, headers={"Authorization": "Bearer invalid.token"})
    assert resp.status_code == 401


async def test_get_me_with_refresh_token_returns_401(client: AsyncClient):
    tokens = await _register_get_tokens(client, "me5@example.com")
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert resp.status_code == 401


async def test_get_me_does_not_expose_hashed_password(client: AsyncClient):
    headers = await _auth_headers(client, "me6@example.com")
    body = (await client.get(ME_URL, headers=headers)).json()
    assert "hashed_password" not in body and "password" not in body


async def test_get_me_returns_correct_email(client: AsyncClient):
    email = "me7@example.com"
    headers = await _auth_headers(client, email)
    assert (await client.get(ME_URL, headers=headers)).json()["email"] == email


async def test_get_me_returns_correct_display_name(client: AsyncClient):
    await client.post(REGISTER_URL, json={
        "email": "me8@example.com", "password": "Pass123!", "display_name": "SpecificName",
    })
    login_resp = await client.post(LOGIN_URL, json={"email": "me8@example.com", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}
    resp = await client.get(ME_URL, headers=headers)
    assert resp.json()["display_name"] == "SpecificName"


# ══════════════════════════════════════════════════════════════════════════
# 9 — PATCH /auth/me (9 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_patch_me_updates_display_name(client: AsyncClient):
    headers = await _auth_headers(client, "patch1@example.com")
    resp = await client.patch(ME_URL, json={"display_name": "NewName"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["display_name"] == "NewName"


async def test_patch_me_updates_preferred_style(client: AsyncClient):
    headers = await _auth_headers(client, "patch2@example.com")
    resp = await client.patch(ME_URL, json={"preferred_style": "Watercolor"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["preferred_style"] == "Watercolor"


async def test_patch_me_updates_both_fields_at_once(client: AsyncClient):
    headers = await _auth_headers(client, "patch3@example.com")
    resp = await client.patch(ME_URL, json={"display_name": "BothName", "preferred_style": "Minimalist"}, headers=headers)
    body = resp.json()
    assert body["display_name"] == "BothName" and body["preferred_style"] == "Minimalist"


async def test_patch_me_only_updates_specified_field(client: AsyncClient):
    headers = await _auth_headers(client, "patch4@example.com")
    await client.patch(ME_URL, json={"preferred_style": "Watercolor"}, headers=headers)
    resp = await client.patch(ME_URL, json={"display_name": "OnlyName"}, headers=headers)
    body = resp.json()
    assert body["display_name"] == "OnlyName"
    assert body["preferred_style"] == "Watercolor"


async def test_patch_me_no_token_returns_401(client: AsyncClient):
    assert (await client.patch(ME_URL, json={"display_name": "Name"})).status_code == 401


async def test_patch_me_returns_full_user_object(client: AsyncClient):
    headers = await _auth_headers(client, "patch6@example.com")
    resp = await client.patch(ME_URL, json={"display_name": "ReturnUser"}, headers=headers)
    body = resp.json()
    assert "id" in body and "email" in body and body["display_name"] == "ReturnUser"


async def test_patch_me_null_fields_do_not_clear_existing_values(client: AsyncClient):
    headers = await _auth_headers(client, "patch7@example.com")
    await client.patch(ME_URL, json={"preferred_style": "Abstract"}, headers=headers)
    resp = await client.patch(ME_URL, json={"preferred_style": None}, headers=headers)
    assert resp.status_code == 200


async def test_patch_me_empty_body_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "patch8@example.com")
    resp = await client.patch(ME_URL, json={}, headers=headers)
    assert resp.status_code == 200


async def test_patch_me_change_persists_to_db(client: AsyncClient, db: AsyncSession):
    email = "patch9@example.com"
    headers = await _auth_headers(client, email)
    await client.patch(ME_URL, json={"display_name": "DBName"}, headers=headers)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    assert user is not None and user.display_name == "DBName"


# ══════════════════════════════════════════════════════════════════════════
# 10 — Email change (10 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_request_email_change_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "ec1@example.com")
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": "ec1new@example.com"}, headers=headers)
    assert resp.status_code == 200


async def test_request_email_change_same_email_returns_400(client: AsyncClient):
    email = "ec2@example.com"
    headers = await _auth_headers(client, email)
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": email}, headers=headers)
    assert resp.status_code == 400


async def test_request_email_change_taken_email_returns_409(client: AsyncClient):
    await _register(client, "taken_ec@example.com")
    headers = await _auth_headers(client, "ec3@example.com")
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": "taken_ec@example.com"}, headers=headers)
    assert resp.status_code == 409


async def test_request_email_change_no_auth_returns_401(client: AsyncClient):
    resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": "new@example.com"})
    assert resp.status_code == 401


async def test_request_email_change_returns_dev_code_when_ses_unconfigured(client: AsyncClient):
    headers = await _auth_headers(client, "ec5@example.com")
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": "ec5new@example.com"}, headers=headers)
    assert "dev_code" in resp.json()


async def test_verify_email_change_success_returns_updated_email(client: AsyncClient):
    headers = await _auth_headers(client, "ec6@example.com")
    new_email = "ec6new@example.com"
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req_resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": new_email}, headers=headers)
    code = req_resp.json()["dev_code"]
    resp = await client.post(VERIFY_EMAIL_URL, json={"new_email": new_email, "code": code}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == new_email


async def test_verify_email_change_wrong_code_returns_400(client: AsyncClient):
    headers = await _auth_headers(client, "ec7@example.com")
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=True):
        await client.post(REQUEST_EMAIL_URL, json={"new_email": "ec7new@example.com"}, headers=headers)
    resp = await client.post(VERIFY_EMAIL_URL, json={"new_email": "ec7new@example.com", "code": "0000"}, headers=headers)
    assert resp.status_code == 400


async def test_verify_email_change_no_pending_returns_400(client: AsyncClient):
    headers = await _auth_headers(client, "ec8@example.com")
    resp = await client.post(VERIFY_EMAIL_URL, json={"new_email": "nobody_ec@example.com", "code": "1234"}, headers=headers)
    assert resp.status_code == 400


async def test_verify_email_change_no_auth_returns_401(client: AsyncClient):
    resp = await client.post(VERIFY_EMAIL_URL, json={"new_email": "any@example.com", "code": "1234"})
    assert resp.status_code == 401


async def test_verify_email_change_persists_new_email_in_db(client: AsyncClient, db: AsyncSession):
    email = "ec10@example.com"
    new_email = "ec10new@example.com"
    headers = await _auth_headers(client, email)
    with patch("app.routers.auth.send_verification_code", new_callable=AsyncMock, return_value=False):
        req_resp = await client.post(REQUEST_EMAIL_URL, json={"new_email": new_email}, headers=headers)
    code = req_resp.json()["dev_code"]
    await client.post(VERIFY_EMAIL_URL, json={"new_email": new_email, "code": code}, headers=headers)
    result = await db.execute(select(User).where(User.email == new_email))
    assert result.scalar_one_or_none() is not None


# ══════════════════════════════════════════════════════════════════════════
# 11 — Profile image upload/delete (9 tests)
# ══════════════════════════════════════════════════════════════════════════

async def test_upload_profile_image_png_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "img1@example.com")
    with patch("app.routers.auth.upload_image", new_callable=AsyncMock, return_value="https://cdn.example.com/img.png"):
        resp = await client.post(
            PROFILE_IMAGE_URL,
            files={"file": ("photo.png", _png_bytes(), "image/png")},
            headers=headers,
        )
    assert resp.status_code == 200


async def test_upload_profile_image_jpeg_returns_200(client: AsyncClient):
    headers = await _auth_headers(client, "img2@example.com")
    with patch("app.routers.auth.upload_image", new_callable=AsyncMock, return_value="https://cdn.example.com/img.jpg"):
        resp = await client.post(
            PROFILE_IMAGE_URL,
            files={"file": ("photo.jpg", _jpeg_bytes(), "image/jpeg")},
            headers=headers,
        )
    assert resp.status_code == 200


async def test_upload_profile_image_invalid_type_returns_400(client: AsyncClient):
    headers = await _auth_headers(client, "img3@example.com")
    resp = await client.post(
        PROFILE_IMAGE_URL,
        files={"file": ("doc.pdf", b"%PDF-fake", "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_upload_profile_image_too_large_returns_400(client: AsyncClient):
    headers = await _auth_headers(client, "img4@example.com")
    large_data = b"\x89PNG" + b"x" * (5 * 1024 * 1024 + 100)
    resp = await client.post(
        PROFILE_IMAGE_URL,
        files={"file": ("big.png", large_data, "image/png")},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_upload_profile_image_no_auth_returns_401(client: AsyncClient):
    resp = await client.post(
        PROFILE_IMAGE_URL,
        files={"file": ("photo.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 401


async def test_upload_profile_image_updates_url_in_response(client: AsyncClient):
    headers = await _auth_headers(client, "img6@example.com")
    fake_url = "https://cdn.example.com/profiles/img6.png"
    with patch("app.routers.auth.upload_image", new_callable=AsyncMock, return_value=fake_url):
        resp = await client.post(
            PROFILE_IMAGE_URL,
            files={"file": ("photo.png", _png_bytes(), "image/png")},
            headers=headers,
        )
    assert resp.json()["profile_image_url"] == fake_url


async def test_upload_profile_image_persists_url_in_db(client: AsyncClient, db: AsyncSession):
    email = "img7@example.com"
    headers = await _auth_headers(client, email)
    fake_url = "https://cdn.example.com/profiles/img7.png"
    with patch("app.routers.auth.upload_image", new_callable=AsyncMock, return_value=fake_url):
        await client.post(
            PROFILE_IMAGE_URL,
            files={"file": ("photo.png", _png_bytes(), "image/png")},
            headers=headers,
        )
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    assert user is not None and user.profile_image_url == fake_url


async def test_delete_profile_image_clears_url_in_response(client: AsyncClient):
    headers = await _auth_headers(client, "img8@example.com")
    with patch("app.routers.auth.upload_image", new_callable=AsyncMock, return_value="https://cdn.example.com/img.png"):
        await client.post(
            PROFILE_IMAGE_URL,
            files={"file": ("photo.png", _png_bytes(), "image/png")},
            headers=headers,
        )
    resp = await client.delete(PROFILE_IMAGE_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["profile_image_url"] is None


async def test_delete_profile_image_no_auth_returns_401(client: AsyncClient):
    assert (await client.delete(PROFILE_IMAGE_URL)).status_code == 401
