"""
test_auth.py — Tests for /auth endpoints.

Covers: register, login, duplicate email, bad credentials, /me.
"""

import pytest
from httpx import AsyncClient


REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
ME_URL = "/auth/me"

USER = {
    "email": "test_auth@example.com",
    "password": "StrongPass123!",
    "display_name": "Test User",
}


async def test_register_returns_token(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json=USER)
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_register_duplicate_email_returns_409(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER)
    resp = await client.post(REGISTER_URL, json=USER)
    assert resp.status_code == 409


async def test_login_returns_token(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER)
    resp = await client.post(
        LOGIN_URL,
        json={"email": USER["email"], "password": USER["password"]},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_wrong_password_returns_401(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER)
    resp = await client.post(
        LOGIN_URL,
        json={"email": USER["email"], "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_me_returns_user_profile(client: AsyncClient):
    reg = await client.post(REGISTER_URL, json=USER)
    token = reg.json()["access_token"]
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == USER["email"]
    assert body["display_name"] == USER["display_name"]
    assert "hashed_password" not in body


async def test_me_without_token_returns_401(client: AsyncClient):
    resp = await client.get(ME_URL)
    assert resp.status_code == 401
