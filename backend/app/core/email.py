import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email over SMTP. Blocking -- call via BackgroundTasks.

    With no SMTP_HOST configured the message is logged instead and False is
    returned, so features that email a link keep working in development and the
    site does not break before an email provider has been chosen.
    """
    if not settings.SMTP_HOST:
        logger.info("Email not configured; would send to %s | %s\n%s", to, subject, body)
        return False

    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            smtp.send_message(msg)
        return True
    except Exception:
        # Never let a mail outage fail the request that triggered it.
        logger.exception("Failed to send email to %s", to)
        return False


def send_verification_email(to: str, token: str) -> bool:
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
    return send_email(
        to,
        "Confirm your 3DVerse email",
        f"Welcome to 3DVerse!\n\nConfirm your email address by opening this link "
        f"(valid for 48 hours):\n{link}\n\nIf you didn't create an account, ignore this email.",
    )


def send_password_reset_email(to: str, token: str) -> bool:
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    return send_email(
        to,
        "Reset your 3DVerse password",
        f"We received a request to reset your password.\n\nChoose a new one here "
        f"(valid for 1 hour, single use):\n{link}\n\nIf you didn't ask for this, ignore "
        f"this email -- your password has not changed.",
    )
