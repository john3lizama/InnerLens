"""
image_retry.py — Background retry loop for escalated image-gen jobs.

WHEN A JOB GETS HERE
--------------------
`app/routers/generate.py` catches `AllProvidersFailed` on the sync path,
creates an `image_jobs` row with `status='pending'`, and calls
`schedule_retry(job_id)` which spawns this worker as an
`asyncio.create_task`. The HTTP response returns 202 immediately.

WHAT THIS WORKER DOES
---------------------
For up to `IMAGE_RETRY_CYCLES` cycles (default 3), with sleeps taken
from `IMAGE_RETRY_BACKOFFS` (default 0s, 30s, 90s), attempt the same
OpenAI -> Gemini race used by the sync path. On the first successful
cycle:

  1. Create a new `Session` row (same shape as the sync path).
  2. Generate all `count` images (the race runs per-image; a cycle only
     counts as "successful" if every image in the batch gets produced).
  3. Upload each to S3, create `GeneratedImage` rows.
  4. Mark the job `status='succeeded'`, set `session_id`.
  5. Send a push: "Your image is ready — tap to view" with the job_id
     in the payload.

If every cycle fails, mark `status='failed'` and send a failure push so
the user isn't left waiting forever.

Reuses existing building blocks from `image_service`:
  - `_generate_one_image` — the provider race (OpenAI -> Gemini).
  - `_make_thumbnail`     — PIL resize helper.
  - `upload_image`        — S3 writer from app.utils.storage.

The worker opens its own DB session (not reused from the HTTP request)
because the HTTP session is closed as soon as we return the 202.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.db.database import async_session
from app.models.generated_image import GeneratedImage
from app.models.image_job import ImageJob
from app.models.session import Session as GenSession  # rename to avoid clash with AsyncSession
from app.services.image_service import _generate_one_image, _make_thumbnail
from app.services.notification_service import send_push
from app.services.providers import AllProvidersFailed
from app.utils.storage import upload_image

logger = logging.getLogger(__name__)

PUSH_SUCCESS_TITLE = "Your image is ready"
PUSH_SUCCESS_BODY = "Tap to view what emerged."
PUSH_FAILURE_TITLE = "Image generation didn't complete"
PUSH_FAILURE_BODY = (
    "We tried a few times but couldn't finish. Tap to try again."
)


def _parse_backoffs(raw: str) -> list[int]:
    """
    Parse IMAGE_RETRY_BACKOFFS. Invalid entries default to 0 so a typo
    in .env doesn't silently skip cycles — it just won't wait before
    retrying, which surfaces the misconfiguration in logs faster.
    """
    out: list[int] = []
    for part in (raw or "").split(","):
        part = part.strip()
        try:
            out.append(max(0, int(part)))
        except ValueError:
            out.append(0)
    return out


def schedule_retry(job_id: uuid.UUID) -> None:
    """
    Fire-and-forget dispatch. Called by the /generate router right
    before returning 202. Uses `asyncio.create_task` so the HTTP
    response doesn't wait on this — it runs until the event loop stops.
    """
    asyncio.create_task(_run_retry_cycles(job_id))


async def _run_retry_cycles(job_id: uuid.UUID) -> None:
    """
    Top-level worker. Owns its own DB session for the full run. Catches
    everything so a bug here doesn't take the event loop down.
    """
    backoffs = _parse_backoffs(settings.IMAGE_RETRY_BACKOFFS)
    cycles = max(1, settings.IMAGE_RETRY_CYCLES)

    async with async_session() as db:
        # Look up the job and stamp started_at
        job = await db.get(ImageJob, job_id)
        if job is None:
            logger.error("retry: job_id=%s not found", job_id)
            return
        if job.status != "pending":
            logger.info(
                "retry: job_id=%s status=%s — already resolved, skipping",
                job_id, job.status,
            )
            return
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

        last_error: str | None = None

        for cycle_index in range(cycles):
            # Sleep BEFORE the cycle. backoffs[0] is typically 0 so the
            # first attempt runs immediately; subsequent cycles wait.
            wait = backoffs[cycle_index] if cycle_index < len(backoffs) else backoffs[-1] if backoffs else 0
            if wait > 0:
                logger.info(
                    "retry: job_id=%s cycle=%d sleeping %ds",
                    job_id, cycle_index + 1, wait,
                )
                await asyncio.sleep(wait)

            logger.info(
                "retry: job_id=%s cycle=%d starting", job_id, cycle_index + 1
            )
            try:
                await _run_one_cycle(db, job)
            except AllProvidersFailed as exc:
                last_error = str(exc)
                logger.warning(
                    "retry: job_id=%s cycle=%d failed: %s",
                    job_id, cycle_index + 1, last_error,
                )
                continue
            except Exception as exc:
                # Non-provider failure (e.g. S3 outage). Treat as fatal
                # for this cycle but keep the loop going — transient DB
                # or network issues might resolve.
                last_error = f"unexpected: {exc}"
                logger.exception(
                    "retry: job_id=%s cycle=%d unexpected error",
                    job_id, cycle_index + 1,
                )
                continue

            # Success — mark and push. `_run_one_cycle` already set
            # status/session_id on the job object.
            await db.commit()
            await send_push(
                db,
                user_id=job.user_id,
                title=PUSH_SUCCESS_TITLE,
                body=PUSH_SUCCESS_BODY,
                data={"jobId": str(job.id)},
            )
            logger.info(
                "retry: job_id=%s succeeded on cycle=%d",
                job_id, cycle_index + 1,
            )
            return

        # ── All cycles failed ──────────────────────────────────────────
        job.status = "failed"
        job.error = last_error or "all retry cycles exhausted"
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await send_push(
            db,
            user_id=job.user_id,
            title=PUSH_FAILURE_TITLE,
            body=PUSH_FAILURE_BODY,
            data={"jobId": str(job.id)},
        )
        logger.error(
            "retry: job_id=%s FAILED after %d cycles: %s",
            job_id, cycles, job.error,
        )


async def _run_one_cycle(db, job: ImageJob) -> None:
    """
    One full [OpenAI -> Gemini, x count images] batch. Either succeeds
    (mutates `job` to mark it succeeded and returns) or raises
    `AllProvidersFailed` so the outer loop moves to the next cycle.

    We create the Session FIRST (so S3 uploads have a key namespace),
    generate all images in memory, and only commit the GeneratedImage
    rows if every one succeeded. A partial batch rolls back the Session
    too, so we never leave orphan DB state pointing at half-uploaded
    S3 keys.
    """
    # Build a Session for this attempt. If the cycle fails we rollback
    # and the next cycle makes a new one.
    session = GenSession(user_id=job.user_id, source="create")
    db.add(session)
    await db.flush()  # populate session.id without committing yet

    gen_images: list[GeneratedImage] = []
    try:
        for _ in range(job.count):
            result = await _generate_one_image(job.prompt)
            image_bytes = result["image_bytes"]
            revised_prompt = result["revised_prompt"]

            image_id = uuid.uuid4()
            s3_key = f"generated/{session.id}/{image_id}.png"
            image_url = await upload_image(image_bytes, s3_key)

            thumb_bytes = _make_thumbnail(image_bytes)
            thumb_key = f"thumbnails/{session.id}/{image_id}.png"
            thumbnail_url = await upload_image(thumb_bytes, thumb_key)

            gen = GeneratedImage(
                id=image_id,
                session_id=session.id,
                image_url=image_url,
                thumbnail_url=thumbnail_url,
                prompt_used=revised_prompt,
                style_used=job.style,
            )
            db.add(gen)
            gen_images.append(gen)
    except AllProvidersFailed:
        await db.rollback()
        raise

    # Success — finalize the job
    job.status = "succeeded"
    job.session_id = session.id
    job.error = None
    job.completed_at = datetime.now(timezone.utc)


async def reconcile_stale_pending_jobs(stale_after_seconds: int = 300) -> None:
    """
    Called from `main.py`'s lifespan startup. Any `image_jobs` rows that
    say `pending` but were created more than `stale_after_seconds` ago
    must belong to a previous process that died mid-retry (asyncio
    tasks don't survive restarts). Mark them failed and push a
    failure notification so users aren't left hanging.
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)

    async with async_session() as db:
        stmt = (
            select(ImageJob)
            .where(ImageJob.status == "pending")
            .where(ImageJob.created_at < cutoff)
        )
        result = await db.execute(stmt)
        stale = list(result.scalars().all())

        if not stale:
            return

        logger.warning(
            "retry: reconciling %d orphan pending job(s) from a prior process",
            len(stale),
        )

        for job in stale:
            job.status = "failed"
            job.error = "backend restart interrupted retry"
            job.completed_at = datetime.now(timezone.utc)
        await db.commit()

        for job in stale:
            await send_push(
                db,
                user_id=job.user_id,
                title=PUSH_FAILURE_TITLE,
                body=PUSH_FAILURE_BODY,
                data={"jobId": str(job.id)},
            )
