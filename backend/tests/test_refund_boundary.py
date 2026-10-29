from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest
from fastapi import HTTPException


def test_production_cannot_report_a_refund_without_gateway_confirmation(monkeypatch):
    from app.api.routers import admin
    from app.models.user import UserRole
    from app.models.return_request import ReturnStatus
    from app.core.config import settings
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    request = NS(id=1, status=ReturnStatus.APPROVED, refund_amount=None, resolution_note=None)
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = request
    with pytest.raises(HTTPException) as error:
        admin.decide_return_request(1, admin.ReturnDecision(status=ReturnStatus.REFUNDED, refund_amount=100), db,
                                    NS(role=UserRole.admin))
    assert error.value.status_code == 503
    assert request.status == ReturnStatus.APPROVED
    db.commit.assert_not_called()
