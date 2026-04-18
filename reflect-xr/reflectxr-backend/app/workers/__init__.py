"""
workers/ — background tasks that run inside the FastAPI event loop.

Today the only worker is `image_retry`, scheduled via
`asyncio.create_task` by the /generate router when the sync path
exhausts both providers. If the worker set grows, consider migrating to
APScheduler (already used for app/jobs/retention.py) for a uniform
registration surface.
"""
