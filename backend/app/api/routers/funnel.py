"""Funnel tracking endpoints.

Anyone's browser may report anonymous steps (rate-limited, whitelisted event names, no
account needed). Storage trouble never reaches the visitor: the answer is always 204.
Admins read the summary to see which channels and products lead to purchases.
"""
import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api import deps
from app.api.routers.admin import require_admin
from app.core.rate_limit import rate_limit
from app.models.funnel_event import FunnelEvent
from app.models.product import Product
from app.models.user import User
from app.schemas.funnel import EventBatch
from app.services import funnel as funnel_service

router = APIRouter()
logger = logging.getLogger(__name__)

# The newest events are enough for the report; this bounds the work for one request.
REPORT_ROW_LIMIT = 200_000


@router.post("", status_code=204, response_class=Response,
             dependencies=[Depends(rate_limit("events", limit=120, window_seconds=60))])
def post_events(batch: EventBatch, db: Session = Depends(deps.get_db)) -> Response:
    try:
        funnel_service.track_events(batch, db)
    except Exception:
        db.rollback()
        logger.exception("funnel: could not store events")
    return Response(status_code=204)


@router.get("/admin/funnel")
def funnel_report(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_active_user)) -> dict:
    require_admin(current_user)
    rows = (db.query(FunnelEvent.anon_id, FunnelEvent.event, FunnelEvent.source, FunnelEvent.product_id)
            .order_by(FunnelEvent.id.desc()).limit(REPORT_ROW_LIMIT).all())
    ids = {row.product_id for row in rows if row.product_id}
    titles = {pid: title for pid, title in db.query(Product.id, Product.title).filter(Product.id.in_(ids)).all()} if ids else {}
    return funnel_service.summarise_funnel(rows, titles)
