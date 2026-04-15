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

History endpoints
-----------------
- GET /chat/sessions            — paginated list of the user's chat sessions
- GET /chat/sessions/{id}       — full message history for one session
Both are scoped to the authenticated user and exclude the "create" flow.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models.session import Session as ChatSession
from app.models.message import Message
from app.models.journal_entry import JournalEntry
from app.models.generated_image import GeneratedImage
from app.schemas.chat import (
    ChatRequest, ChatResponse,
    ChatGenerateRequest, ChatGenerateResponse,
    ChatSessionSummary, ChatSessionDetail, ChatMessage,
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
    result = await handle_chat_message(
        db=db,
        user_id=current_user.id,
        session_id=request.session_id,
        message=request.message,
    )
    return result


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


# ── History endpoints ────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[ChatSessionSummary])
async def list_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /chat/sessions — paginated list of the user's MindMate conversations.

    Filters to sessions with source != 'create' (i.e., MindMate chat only,
    including Alexa/HomePod-originated chats which also use source='chat').
    For each session we aggregate: message count, journal count, whether any
    artwork was produced, and a short preview from the first user message.
    Ordered newest-first by session.created_at.

    Implementation note: single query with correlated subqueries. Easier to
    read than a multi-JOIN + GROUP BY, and at our scale (at most a few
    hundred rows per user) the planner will handle this fine — the outer
    scan is bounded by LIMIT and the existing (user_id, created_at) partial
    index on `sessions`.
    """
    # Correlated scalars, one per metric. MIN(created_at) + MIN(content)
    # would give us the first-message preview in a single pass, but we want
    # content from the *first user* row specifically, so use a dedicated
    # subquery ordered by created_at ASC LIMIT 1.
    msg_count = (
        select(func.count(Message.id))
        .where(Message.session_id == ChatSession.id)
        .correlate(ChatSession)
        .scalar_subquery()
    )
    journal_count = (
        select(func.count(JournalEntry.id))
        .where(JournalEntry.session_id == ChatSession.id)
        .correlate(ChatSession)
        .scalar_subquery()
    )
    has_image = (
        select(func.count(GeneratedImage.id) > 0)
        .where(GeneratedImage.session_id == ChatSession.id)
        .correlate(ChatSession)
        .scalar_subquery()
    )
    first_user_preview = (
        select(func.substr(Message.content, 1, 80))
        .where(
            Message.session_id == ChatSession.id,
            Message.role == "user",
        )
        .order_by(Message.created_at.asc())
        .limit(1)
        .correlate(ChatSession)
        .scalar_subquery()
    )

    stmt = (
        select(
            ChatSession.id,
            ChatSession.created_at,
            first_user_preview.label("preview"),
            msg_count.label("message_count"),
            journal_count.label("journal_count"),
            has_image.label("has_image"),
        )
        .where(
            ChatSession.user_id == current_user.id,
            ChatSession.source != "create",
        )
        .order_by(ChatSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return [
        ChatSessionSummary(
            id=row.id,
            created_at=row.created_at,
            preview=row.preview or "",
            message_count=row.message_count or 0,
            journal_count=row.journal_count or 0,
            has_image=bool(row.has_image),
        )
        for row in result.all()
    ]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /chat/sessions/{id} — full ordered message history for one session.

    404 if the session doesn't exist OR it belongs to another user — we
    collapse those two cases intentionally so existence isn't probeable.
    """
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.source != "create",
        )
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = messages_result.scalars().all()

    return ChatSessionDetail(
        id=session.id,
        created_at=session.created_at,
        messages=[
            ChatMessage(
                id=m.id,
                role=m.role,
                content=m.content,
                emotion_tags=m.emotion_tags or None,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


# ── Deletion endpoints ───────────────────────────────────────────────────

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    DELETE /chat/sessions/{id} — Cascade-delete one chat session.

    The cascade on Session.messages / .images / .journal_entries
    (app/models/session.py) takes down all linked rows atomically. This is a
    hard delete — callers should confirm with the user first, since any
    journal entries written from this conversation will also be removed.

    Returns 204 even if the session was already gone (idempotent), but 404 if
    a different user owns the row so existence isn't probeable.
    """
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.source != "create",
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    await db.delete(session)
    await db.commit()


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    DELETE /chat/sessions — Cascade-delete ALL of this user's MindMate chats.

    Only touches `source != 'create'` rows, so any Concept→Generate sessions
    (and their journals) remain intact. Iterates with ORM delete so the
    relationship cascade fires per row.
    """
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == current_user.id,
            ChatSession.source != "create",
        )
    )
    sessions = result.scalars().all()
    for s in sessions:
        await db.delete(s)
    await db.commit()
