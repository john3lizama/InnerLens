"""
chat.py router — MindMate chat endpoints.

FLOW:
1. User sends a message -> POST /chat
2. Safety module checks for crisis keywords FIRST
3. If safe, build context from last 5 message pairs
4. Call GPT-4o for empathetic response
5. Extract emotions from the conversation
6. Check if auto-generation should trigger
7. Return everything to the frontend

If the frontend gets should_generate_image=True, it calls
POST /chat/generate-from-conversation to create art.
"""

import traceback
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.schemas.chat import (
    ChatRequest, ChatResponse,
    ChatGenerateRequest, ChatGenerateResponse,
)
from app.services.auth_service import get_current_user
from app.services.chat_service import handle_chat_message, generate_from_conversation

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /chat — Send a message to MindMate.

    The heavy lifting happens in chat_service.py.
    This router just passes the data through.
    """
    try:
        result = await handle_chat_message(
            db=db,
            user_id=current_user.id,
            session_id=request.session_id,
            message=request.message,
        )
        return result
    except Exception:
        return JSONResponse(status_code=500, content={"debug_traceback": traceback.format_exc()})


@router.post("/generate-from-conversation", response_model=ChatGenerateResponse)
async def chat_generate(
    request: ChatGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /chat/generate-from-conversation — Auto-generate art from chat emotions.

    Called by the frontend when should_generate_image was True.
    Reads the session's messages, extracts emotions, builds a prompt,
    generates one image, and returns it.
    """
    result = await generate_from_conversation(
        db=db,
        user_id=current_user.id,
        session_id=request.session_id,
    )
    return result
