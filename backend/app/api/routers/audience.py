"""Audience popup endpoints.

Anyone's browser may save answers (rate-limited, validated choices, no account). The answer is
always 204, so the endpoint cannot be used to look people up. Only admins read the results.
"""
import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api import deps
from app.api.routers.admin import require_admin
from app.core.rate_limit import rate_limit
from app.models.audience_response import AudienceResponse
from app.models.user import User
from app.schemas.audience import AudienceAnswers
from app.services import audience as audience_service

router = APIRouter()
logger = logging.getLogger(__name__)

REPORT_ROW_LIMIT = 5000


@router.post("", status_code=204, response_class=Response,
             dependencies=[Depends(rate_limit("audience", limit=60, window_seconds=3600))])
def save_audience_answers(data: AudienceAnswers, db: Session = Depends(deps.get_db)) -> Response:
    try:
        audience_service.save_answers(db, data)
    except Exception:
        db.rollback()
        logger.exception("audience: could not save answers")
    return Response(status_code=204)


@router.get("/admin")
def audience_summary(db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_active_user)) -> dict:
    require_admin(current_user)
    rows = db.query(AudienceResponse).order_by(AudienceResponse.id.desc()).limit(REPORT_ROW_LIMIT).all()
    return audience_service.summarise(rows)
