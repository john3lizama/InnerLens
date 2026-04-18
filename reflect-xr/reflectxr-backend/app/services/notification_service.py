"""
notification_service.py — Send push notifications via Expo's relay.

Why Expo's relay:
- Our mobile client registers an Expo push token (`ExponentPushToken[...]`).
- Expo forwards each notification to APNs (iOS) or FCM (Android) on our
  behalf, so the backend never has to deal with Apple/Google auth,
  certificates, or their wire protocols.
- Free for reasonable volumes; no Expo account credentials needed to
  send — the token itself proves routing authority.

What this module does:
- `send_push(db, user_id, title, body, data)` — look up every active
  UserPushToken for the user, POST a single batch to
  EXPO_PUSH_URL, and soft-delete any tokens Expo reports as dead
  (`DeviceNotRegistered`). Errors on individual tokens don't block
  delivery to the others.

Called from:
- app/workers/image_retry.py — on successful retry or terminal failure.

The module is deliberately side-effect-only; callers don't check a
return value. A best-effort "we tried" is what we want — pushes
failing shouldn't fail the job itself.
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user_push_token import UserPushToken

logger = logging.getLogger(__name__)


async def send_push(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """
    Fire-and-(log-)forget push notification to every active device for
    a user.

    `data` is opaque to Expo — it's delivered verbatim to the mobile
    client's notification handler. Use it for routing info like
    `{ "jobId": "..." }` so the tap handler can deep-link.
    """
    data = data or {}

    # ── Load active tokens ─────────────────────────────────────────────
    stmt = (
        select(UserPushToken)
        .where(UserPushToken.user_id == user_id)
        .where(UserPushToken.revoked_at.is_(None))
    )
    result = await db.execute(stmt)
    tokens: list[UserPushToken] = list(result.scalars().all())

    if not tokens:
        logger.info("push: no active tokens for user_id=%s; skipping", user_id)
        return

    # ── Build one Expo push message per token ──────────────────────────
    # Expo accepts an array of messages in a single POST; the response is
    # an array of {status, id?, message?, details?} one per input.
    messages = [
        {
            "to": t.token,
            "title": title,
            "body": body,
            "data": data,
            "sound": None,  # silent by default; chat-retention notifications
                            # use a sound, but a completion ping shouldn't
                            # buzz someone out of focus.
            "priority": "default",
        }
        for t in tokens
    ]

    # ── Send ───────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.post(
                settings.EXPO_PUSH_URL,
                json=messages,
                headers={
                    "accept": "application/json",
                    "accept-encoding": "gzip, deflate",
                    "content-type": "application/json",
                },
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        # Don't raise — the caller is typically a background worker, and
        # failing a whole job because a push couldn't be sent is worse
        # than logging and moving on.
        logger.warning("push: relay call failed: %s", exc)
        return

    # ── Reconcile per-token results ────────────────────────────────────
    # Expo's response shape: { "data": [ { status, id?, message?, details? }, ... ] }
    # A `DeviceNotRegistered` in `details.error` means the device uninstalled
    # or got a new token — soft-delete so we stop trying.
    items = payload.get("data") or []
    if not isinstance(items, list):
        logger.warning("push: unexpected response shape: %s", payload)
        return

    now = datetime.now(timezone.utc)
    for token_row, item in zip(tokens, items):
        status = item.get("status")
        if status == "ok":
            continue
        details = item.get("details") or {}
        error = details.get("error") or item.get("message") or "unknown"
        logger.info(
            "push: delivery failed user_id=%s token_suffix=...%s error=%s",
            user_id, token_row.token[-8:], error,
        )
        if error == "DeviceNotRegistered":
            await db.execute(
                update(UserPushToken)
                .where(UserPushToken.id == token_row.id)
                .values(revoked_at=now)
            )
    await db.commit()
