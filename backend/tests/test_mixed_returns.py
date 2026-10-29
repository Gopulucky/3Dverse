from datetime import datetime, timedelta
from types import SimpleNamespace as NS
from unittest.mock import Mock


def test_mixed_order_keeps_seven_day_seller_window_after_defect_deadline():
    from app.services.returns import order_return_policy
    from app.models.user import CreatorType
    def line(id, creator_type):
        return NS(id=id, product_id=id, quantity=1, selected_config={"purchase_type": "physical"},
                  product=NS(creator=NS(creator_type=creator_type), digital_download_enabled=False,
                             is_mode_3_active=True))
    order = NS(items=[line(1, CreatorType.studio), line(2, CreatorType.seller)],
               delivered_at=datetime.utcnow() - timedelta(days=3), status="delivered", defect_reported=False)
    policy = order_return_policy(order)
    assert policy["window_open"] is False  # the order-level defect action remains 48h
    assert policy["items"][0]["window_open"] is False
    assert policy["items"][1]["window_open"] is True
    assert policy["items"][1]["window_closes_at"] == order.delivered_at + timedelta(days=7)


def test_return_endpoint_uses_selected_lines_seven_day_window(monkeypatch):
    import app.main  # noqa: F401: register model relationships
    from app.api.routers import orders
    from app.models.return_request import ReturnReason
    order = NS(id=7)
    item = NS(id=2, quantity=1)
    db = Mock()
    db.query.return_value.filter.return_value.first.side_effect = [order, item]
    db.query.return_value.filter.return_value.with_entities.return_value.all.return_value = []
    monkeypatch.setattr(orders.returns, "order_return_policy", lambda order: {
        "window_open": False, "items": [{"order_item_id": 2, "policy": "standard_return", "window_open": True}]})
    result = orders.request_return(7, orders.ReturnRequestCreate(order_item_id=2, reason=ReturnReason.OTHER), db, NS(id=9))
    assert result["status"] == "requested"
    db.commit.assert_called_once()
