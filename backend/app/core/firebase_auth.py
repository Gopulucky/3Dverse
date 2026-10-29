"""Firebase owns credentials; our database owns account state and roles."""
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import HTTPException

from app.core.config import settings


@lru_cache(maxsize=1)
def _initialize(project_id: str):
    # Application Default Credentials: workload identity or a server-only file.
    # Never accept credentials, a project ID or an emulator host from a request.
    credential = (credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
                  if settings.GOOGLE_APPLICATION_CREDENTIALS else None)
    return firebase_admin.initialize_app(credential, options={"projectId": project_id}, name="3dverse-auth")


def firebase_app():
    if settings.is_production and os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
        raise HTTPException(503, "Sign-in is temporarily unavailable")
    if not settings.FIREBASE_PROJECT_ID:
        raise HTTPException(503, "Sign-in is temporarily unavailable")
    try:
        return _initialize(settings.FIREBASE_PROJECT_ID)
    except Exception:
        raise HTTPException(503, "Sign-in is temporarily unavailable") from None


def verify_token(token: str) -> dict:
    app = firebase_app()
    try:
        # SDK verifies signature, audience, issuer, expiry and disabled/revoked users.
        return auth.verify_id_token(token, app=app, check_revoked=True)
    except auth.CertificateFetchError:
        raise HTTPException(503, "Sign-in is temporarily unavailable") from None
    except auth.UserNotFoundError:
        raise HTTPException(401, "Please sign in again") from None
    except (ValueError, auth.InvalidIdTokenError, auth.RevokedIdTokenError,
            auth.UserDisabledError):
        raise HTTPException(401, "Please sign in again") from None
    except Exception:
        raise HTTPException(503, "Sign-in is temporarily unavailable") from None
