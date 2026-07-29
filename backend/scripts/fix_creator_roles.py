"""Promote accounts that finished creator onboarding but kept the customer role.

Until this was fixed, POST /api/creator/onboarding/type set `creator_type` and
`onboarding_completed` without ever setting `role`, so the account got the whole
Creator Studio UI (which gates on creator_type) while every creator-only endpoint
answered 403. The path choice is one-time and locked, so re-running onboarding
cannot repair an affected account -- hence this backfill.

Run (from backend/):  python scripts/fix_creator_roles.py
                      python scripts/fix_creator_roles.py --apply

Without --apply it only reports what it would change. Idempotent: accounts that
already hold a non-customer role are left alone, so admins and print partners
who happen to have a creator path are never demoted or promoted.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.models.printer  # noqa: F401 — register mappers
import app.models.material  # noqa: F401
import app.models.notification  # noqa: F401
from app.core.database import SessionLocal
from app.models.creator import Creator
from app.models.user import User, UserRole


def main() -> None:
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        affected = (
            db.query(User)
            .filter(User.creator_type.isnot(None), User.role == UserRole.customer)
            .order_by(User.id)
            .all()
        )

        if not affected:
            print("Nothing to do: no customer-role accounts have a creator path set.")
            return

        print(f"{len(affected)} account(s) finished creator onboarding but are still 'customer':")
        for user in affected:
            print(f"  id={user.id:<5} {user.email:<40} path={user.creator_type.value}")

        if not apply:
            print("\nDry run. Re-run with --apply to promote these accounts to 'creator'.")
            return

        for user in affected:
            user.role = UserRole.creator
            db.add(user)
            # The printer onboarding step normally creates this, but it is
            # role-gated and was therefore unreachable for exactly these users.
            if not db.query(Creator).filter(Creator.user_id == user.id).first():
                db.add(Creator(user_id=user.id))

        db.commit()
        print(f"\nPromoted {len(affected)} account(s) to the creator role.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
