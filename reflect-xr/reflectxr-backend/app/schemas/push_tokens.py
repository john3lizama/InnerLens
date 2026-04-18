"""
push_tokens.py schemas — Register/revoke Expo push tokens.

The mobile client calls POST /users/push_tokens after the user grants
notification permission. We upsert by token (unique), so calling this
on every launch is safe — existing rows just update `user_id`/`platform`
if the device has been handed off between accounts.
"""

from pydantic import BaseModel, Field


class RegisterPushTokenRequest(BaseModel):
    # Expo tokens look like `ExponentPushToken[xxxxxxxxxxxxxx]`. We don't
    # validate the format beyond "non-empty string" — Expo is the source
    # of truth, and rejecting malformed tokens at registration time just
    # means more "why didn't my notification arrive" bugs to debug.
    token: str = Field(..., min_length=1)
    platform: str = Field(..., pattern="^(ios|android)$")


class RegisterPushTokenResponse(BaseModel):
    status: str = "ok"
