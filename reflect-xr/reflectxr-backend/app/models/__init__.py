"""
models/__init__.py — Import all models so SQLAlchemy knows about them.

WHY THIS FILE MATTERS:
When Alembic runs migrations or when we create tables, SQLAlchemy needs to
"see" every model class. Importing them here ensures they're all registered
with Base.metadata. If you forget to import a model here, its table won't
be created.
"""

from app.models.user import User
from app.models.concept import Concept, Style
from app.models.session import Session
from app.models.message import Message
from app.models.generated_image import GeneratedImage
from app.models.journal_entry import JournalEntry
from app.models.email_verification import EmailVerification
from app.models.pending_registration import PendingRegistration

# This list makes it easy to import everything at once:
# from app.models import User, Concept, etc.
__all__ = [
    "User",
    "Concept",
    "Style",
    "Session",
    "Message",
    "GeneratedImage",
    "JournalEntry",
    "EmailVerification",
    "PendingRegistration",
]
