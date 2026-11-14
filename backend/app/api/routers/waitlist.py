"""Pre-launch waitlist for printed products.

Anyone can join (rate-limited, no account needed). The response is the same
whether the email was new or already listed, so the endpoint can't be used to
check who has signed up. Admins read a summary to judge demand.
"""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.api.routers.admin import require_admin
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.waitlist import WaitlistSignup
from app.schemas.waitlist import WaitlistJoin

router = APIRouter()

JOINED = {"status": "joined"}


@router.post("", dependencies=[Depends(rate_limit("waitlist", limit=5, window_seconds=3600))])
def join_waitlist(data: WaitlistJoin, db: Session = Depends(deps.get_db)) -> dict:
    row = db.query(WaitlistSignup).filter(WaitlistSignup.email == data.email).first()
    now = datetime.utcnow()
    if row is None:
        row = WaitlistSignup(email=data.email, created_at=now)
        db.add(row)
    row.interest = data.interest
    row.price_choice = data.price_choice
    row.city = data.city
    row.source = data.source
    row.consented_at = now
    db.commit()
    return JOINED


def summarise(rows) -> dict:
    rows = list(rows)
    cities = Counter()
    labels: dict[str, str] = {}
    for row in rows:
        if row.city and row.city.strip():
            key = row.city.strip().casefold()
            cities[key] += 1
            labels.setdefault(key, row.city.strip())
    return {
        "total": len(rows),
        "by_interest": dict(Counter(row.interest for row in rows).most_common()),
        "by_price": dict(Counter(row.price_choice or "no_answer" for row in rows).most_common()),
        "top_cities": [{"city": labels[key], "count": n} for key, n in cities.most_common(10)],
        "signups": [
            {"email": row.email, "interest": row.interest, "price_choice": row.price_choice,
             "city": row.city, "source": row.source, "created_at": row.created_at.isoformat() if row.created_at else None}
            for row in rows
        ],
    }


@router.get("/admin")
def waitlist_summary(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_active_user)) -> dict:
    require_admin(current_user)
    rows = db.query(WaitlistSignup).order_by(WaitlistSignup.created_at.desc()).limit(5000).all()
    return summarise(rows)
