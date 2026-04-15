"""Background jobs for the ReflectXR API.

These run inside the FastAPI event loop via APScheduler wiring in main.py.
Keep each job pure (takes a db session factory, commits its own session) so
tests can call it directly.
"""
