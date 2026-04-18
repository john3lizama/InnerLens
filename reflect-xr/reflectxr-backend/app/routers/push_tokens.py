"""
push_tokens.py router — Register/revoke Expo push tokens.

ENDPOINTS
  POST   /users/push_tokens              — upsert token for current user
  DELETE /users/push_tokens/{token}      — soft-revoke (e.g. on logout)

Auth required. The token is the Expo-issued string from
`Notifications.getExpoPushTokenAsync({ projectId })` on the client.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Path
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user_push_token import UserPushToken
from app.schemas.push_tokens import (
    RegisterPushTokenRequest,
    RegisterPushTokenResponse,
)
from app.services.auth_service import get_current_user

router = APIRouter()


@router.post("", response_model=RegisterPushTokenResponse)
async def register_push_token(
    request: RegisterPushTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Upsert a push token for the authenticated user.

    Idempotent — the mobile client calls this on every launch that
    yields a token, so we must not create duplicates. Resolution
    strategy when the token already exists:

      - Same user + not revoked → no-op.
      - Same user + revoked     → un-revoke (device reinstalled and got
                                  the same token back).
      - Different user          → reassign to the current user (device
                                  handoff / account switch on a shared
                                  device). The old row is orphaned by
                                  being soft-revoked.
    """
    # Look up an existing row for this token (unique constraint)
    stmt = select(UserPushToken).where(UserPushToken.token == request.token)
    existing = (await db.execute(stmt)).scalar_one_or_none()

    if existing is None:
        # Fresh registration
        row = UserPushToken(
            user_id=current_user.id,
            token=request.token,
            platform=request.platform,
        )
        db.add(row)
        await db.commit()
        return RegisterPushTokenResponse()

    # Existing row — reconcile
    if existing.user_id == current_user.id:
        if existing.revoked_at is not None:
            existing.revoked_at = None  # un-revoke on reinstall
        existing.platform = request.platform  # in case OS changed
    else:
        # Account switch on shared device: move ownership
        existing.user_id = current_user.id
        existing.platform = request.platform
        existing.revoked_at = None
    await db.commit()
    return RegisterPushTokenResponse()


@router.delete("/{token}", response_model=RegisterPushTokenResponse)
async def revoke_push_token(
    token: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Soft-revoke a token. Called on explicit logout so notifications
    don't continue reaching a device after sign-out.

    We only revoke tokens owned by the caller — if someone else's token
    somehow ends up in the URL (scraped from a debug log, etc.), the
    scope check keeps it safe.
    """
    await db.execute(
        update(UserPushToken)
        .where(UserPushToken.token == token)
        .where(UserPushToken.user_id == current_user.id)
        .where(UserPushToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return RegisterPushTokenResponse()
