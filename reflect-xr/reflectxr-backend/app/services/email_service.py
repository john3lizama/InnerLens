"""
email_service.py — Send transactional emails via AWS SES.

Uses the same AWS credentials as S3 storage. SES must be configured
in the same region (us-east-1) with the sender email verified.

For development/sandbox mode, both sender AND recipient must be verified
in the SES console. For production, request production access to send
to any address.
"""

import boto3
from botocore.exceptions import ClientError
from app.config import settings

# Reuse the same AWS credentials as S3
ses_client = boto3.client(
    "ses",
    region_name="us-east-1",
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
)

# The "From" address — must be verified in SES
SENDER_EMAIL = settings.SES_SENDER_EMAIL


async def send_verification_code(to_email: str, code: str) -> bool:
    """
    Send a 4-digit verification code to the given email address.

    Returns True if sent successfully, False on failure.
    """
    subject = "ReflectXR — Verify your new email"
    body_text = (
        f"Your verification code is: {code}\n\n"
        f"Enter this code in the app to confirm your email change.\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )
    body_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h2 style="color: #2D2B3D; font-size: 22px; margin-bottom: 8px;">Verify your new email</h2>
        <p style="color: #7A7888; font-size: 15px; line-height: 1.5; margin-bottom: 32px;">
            Enter this code in the app to confirm your email change.
        </p>
        <div style="background: #F0EDF8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #6C63FF;">{code}</span>
        </div>
        <p style="color: #A8A6B4; font-size: 13px; line-height: 1.4;">
            This code expires in 10 minutes.<br/>
            If you didn't request this change, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #EEEDEA; margin: 32px 0 16px;" />
        <p style="color: #A8A6B4; font-size: 12px;">ReflectXR by InnerLens</p>
    </div>
    """

    try:
        ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        )
        return True
    except ClientError as e:
        print(f"SES send failed: {e.response['Error']['Message']}")
        return False
