"""
journal.py router — CRUD for journal entries (reflections).

After the user selects an image, they write a reflection.
Saving the reflection triggers emotion extraction (NLP)
which tags the entry with emotions like "hope", "anxiety", etc.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.models.journal_entry import JournalEntry
from app.models.generated_image import GeneratedImage
from app.schemas.journal import (
    JournalCreateRequest, JournalCreateResponse,
    JournalListResponse, JournalListItem, JournalImageSummary,
    JournalDetailResponse,
)
from app.services.auth_service import get_current_user
from app.services.emotion_service import extract_emotions

router = APIRouter()


@router.post("", response_model=JournalCreateResponse,
             status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    request: JournalCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /journal — Save a reflection and run emotion extraction.

    Steps:
    1. Calculate word count from content
    2. Run emotion_service.extract_emotions() on the text (NLP — R5)
    3. Create the JournalEntry row with emotion tags
    4. Commit and return
    """
    # Count words in the reflection
    word_count = len(request.content.split())

    # Run NLP emotion extraction on the journal text
    emotion_tags = await extract_emotions(request.content)

    # Create the database row
    entry = JournalEntry(
        user_id=current_user.id,
        image_id=request.image_id,
        session_id=request.session_id,
        content=request.content,
        reflection_prompt_used=request.reflection_prompt_used,
        emotion_tags=emotion_tags,
        word_count=word_count,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return JournalCreateResponse(
        id=entry.id,
        created_at=entry.created_at,
        emotion_tags=emotion_tags,
        word_count=word_count,
    )


@router.get("", response_model=JournalListResponse)
async def list_journal_entries(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /journal — Paginated list of the user's journal entries.

    Returns content truncated to 100 characters for the list view.
    Includes a thumbnail of the associated image.
    """
    # Count total entries for this user
    count_result = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.user_id == current_user.id
        )
    )
    total = count_result.scalar()

    # Fetch the page of entries, newest first
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = result.scalars().all()

    # Build response with truncated content and image thumbnails
    items = []
    for entry in entries:
        # Load the associated image for the thumbnail
        img_result = await db.execute(
            select(GeneratedImage).where(GeneratedImage.id == entry.image_id)
        )
        image = img_result.scalar_one_or_none()

        items.append(JournalListItem(
            id=entry.id,
            content=entry.content[:100],     # Truncate for list view
            emotion_tags=entry.emotion_tags or [],
            image=JournalImageSummary(
                id=image.id,
                image_url=image.image_url,
                thumbnail_url=image.thumbnail_url,
            ) if image else None,
            created_at=entry.created_at,
            word_count=entry.word_count,
        ))

    return JournalListResponse(entries=items, total=total)


@router.get("/{entry_id}", response_model=JournalDetailResponse)
async def get_journal_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /journal/:id — Full detail of one journal entry.

    Returns the full content (not truncated) plus the associated image.
    Returns 404 if the entry doesn't exist or belongs to another user.
    """
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # Load the associated image
    img_result = await db.execute(
        select(GeneratedImage).where(GeneratedImage.id == entry.image_id)
    )
    image = img_result.scalar_one_or_none()

    return JournalDetailResponse(
        id=entry.id,
        content=entry.content,                # Full text
        emotion_tags=entry.emotion_tags or [],
        image=JournalImageSummary(
            id=image.id,
            image_url=image.image_url,
            thumbnail_url=image.thumbnail_url,
        ) if image else None,
        reflection_prompt_used=entry.reflection_prompt_used,
        created_at=entry.created_at,
        word_count=entry.word_count,
    )
