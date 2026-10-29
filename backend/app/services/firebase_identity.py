import secrets

from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole


def active(user):
    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(403, "This account is unavailable. Contact support for help.")
    return user


def email_from(claims):
    try:
        return str(TypeAdapter(EmailStr).validate_python(claims.get("email"))).lower()
    except ValidationError:
        raise HTTPException(400, "Use a Google or email account with an email address") from None


def persist(db, user):
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Account already exists. Please sign in again.") from None
    return user


def resolve_identity(db, claims, *, create=False):
    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(401, "Please sign in again")
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if user:
        active(user)
        # Firebase email changes cannot silently change the marketplace identity.
        # Verification only upgrades the same address, never another address.
        if (claims.get("email_verified") is True and
                str(claims.get("email", "")).lower() == user.email.lower() and not user.email_verified):
            user.email_verified = True
            return persist(db, user)
        return user
    if not create:
        raise HTTPException(401, "Finish signing in to your 3DVerse account")
    email = email_from(claims)
    existing = db.query(User).filter(User.email.ilike(email)).first()
    if existing:
        raise HTTPException(409, "This email already has a 3DVerse account. Connect it using your previous password.")
    user = User(email=email, firebase_uid=uid, role=UserRole.customer,
                hashed_password=get_password_hash(secrets.token_urlsafe(48)),
                full_name=str(claims.get("name", ""))[:200] or None,
                email_verified=claims.get("email_verified") is True,
                is_active=True, token_version=0)
    return persist(db, user)


def link_identity(db, claims, previous_password):
    if claims.get("email_verified") is not True:
        raise HTTPException(400, "Verify your email before connecting an existing account")
    email = email_from(claims)
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user or not verify_password(previous_password, user.hashed_password):
        raise HTTPException(401, "The previous 3DVerse password is incorrect")
    active(user)
    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(401, "Please sign in again")
    owner = db.query(User).filter(User.firebase_uid == uid).first()
    if (user.firebase_uid and user.firebase_uid != uid) or (owner and owner.id != user.id):
        raise HTTPException(409, "This account is already connected to another sign-in")
    user.firebase_uid = uid
    user.email_verified = True
    # Revoke old app JWTs. Linked accounts can no longer use local password login.
    user.token_version += 1
    return persist(db, user)
