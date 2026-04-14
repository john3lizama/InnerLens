"""
storage.py — Upload images to S3-compatible storage.

Supports AWS S3, Cloudflare R2, or any S3-compatible service.
The credentials come from .env via config.py.

IMAGE KEY PATTERNS:
- Full images:  generated/{session_id}/{image_id}.png
- Thumbnails:   thumbnails/{session_id}/{image_id}.png
"""

import boto3
from app.config import settings

# ── S3 client ────────────────────────────────────────────────────────────
# boto3 is Amazon's Python SDK. It works with any S3-compatible service
# (not just AWS) — you just change the endpoint_url.
s3_client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL or None,
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
)


async def upload_image(file_bytes: bytes, key: str, content_type: str = "image/png") -> str:
    """
    Upload image bytes to S3. Returns the public URL.

    Parameters:
        file_bytes:   The raw image data
        key:          The S3 object key (path), e.g., "generated/abc123/img1.png"
        content_type: MIME type (default: image/png)

    Returns:
        The public URL where the image can be accessed
    """
    s3_client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"{settings.S3_PUBLIC_URL}/{key}"
