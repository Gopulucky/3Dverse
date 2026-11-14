"""Buy Now: one product goes straight to checkout; the cart is never read or changed.

Offline, on the same SQLite fixture the payment tests use.
"""
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from test_payments import payment, payment_db, payments, seed_cart  # noqa: F401 (fixtures)


def second_product(db, creator_id, **changes):
    from app.models.product import Product
    values = dict(title="Other model", creator_id=creator_id, currency="INR", price=50,
                  base_print_price=200, status="published", safety_review_status="approved",
                  is_mode_2_active=True, digital_download_enabled=True, is_mode_3_active=True)
    values.update(changes)
    item = Product(**values)
    db.add(item)
    db.commit()
    return item


def direct(product_id, kind="digital", quantity=1, **config):
    from app.api.routers.checkout import CheckoutRequest, DirectItem
    return CheckoutRequest(
        idempotency_key=f"buy-now-{product_id}-{kind}-{quantity}",
        direct_item=DirectItem(product_id=product_id, quantity=quantity, purchase_type=kind,
                               selected_config=config or None))


def cart_lines(db):
    from app.models.cart import CartItem
    return sorted((row.product_id, row.selected_config["purchase_type"], row.quantity)
                  for row in db.query(CartItem).all())


def pay(db, service, order):
    return service.apply_payment(db, order, payment(order_id=order.razorpay_order_id or "order_x", amount=order.amount_minor))


def test_direct_item_buys_only_that_product_and_ignores_the_cart(payment_db):
    service = payments()
    user, cart_product = seed_cart(payment_db)  # cart: cart_product x2
    other = second_product(payment_db, user.id)
    order = service.prepare_order(payment_db, user, direct(other.id))
    assert [(i.product_id, i.quantity) for i in order.items] == [(other.id, 1)]
    assert order.amount_minor == 5000 and order.shipping_cost == 0
    assert cart_lines(payment_db) == [(cart_product.id, "digital", 2)]


def test_a_direct_order_works_with_an_empty_cart(payment_db):
    service = payments()
    user, cart_product = seed_cart(payment_db)
    from app.models.cart import CartItem
    payment_db.query(CartItem).delete()
    payment_db.commit()
    order = service.prepare_order(payment_db, user, direct(cart_product.id))
    assert [(i.product_id, i.quantity) for i in order.items] == [(cart_product.id, 1)]


def test_paying_a_direct_order_leaves_the_cart_untouched(payment_db):
    service = payments()
    user, cart_product = seed_cart(payment_db)
    other = second_product(payment_db, user.id)
    order = service.prepare_order(payment_db, user, direct(other.id))
    order.razorpay_order_id = "order_x"
    payment_db.commit()
    assert pay(payment_db, service, order) is True
    payment_db.commit()
    assert cart_lines(payment_db) == [(cart_product.id, "digital", 2)]


def test_paying_a_direct_order_for_a_product_also_in_the_cart_keeps_the_cart_line(payment_db):
    service = payments()
    user, cart_product = seed_cart(payment_db)  # cart already holds cart_product x2 (digital)
    order = service.prepare_order(payment_db, user, direct(cart_product.id))
    order.razorpay_order_id = "order_x"
    payment_db.commit()
    assert pay(payment_db, service, order) is True
    payment_db.commit()
    assert cart_lines(payment_db) == [(cart_product.id, "digital", 2)]


def test_a_cart_hold_is_not_reused_for_a_direct_purchase_of_the_same_product(payment_db):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    user, cart_product = seed_cart(payment_db)
    from app.models.cart import CartItem
    payment_db.query(CartItem).one().quantity = 1
    payment_db.commit()
    cart_order = service.prepare_order(payment_db, user, CheckoutRequest(idempotency_key="cart-attempt"))
    buy_now = service.prepare_order(payment_db, user, direct(cart_product.id))
    assert buy_now.id != cart_order.id
    assert all((i.selected_config or {}).get("buy_now") for i in buy_now.items)
    assert cart_order.status == "cancelled"


def test_a_direct_hold_is_not_reused_for_a_cart_checkout(payment_db):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    user, cart_product = seed_cart(payment_db)
    from app.models.cart import CartItem
    payment_db.query(CartItem).one().quantity = 1
    payment_db.commit()
    buy_now = service.prepare_order(payment_db, user, direct(cart_product.id))
    cart_order = service.prepare_order(payment_db, user, CheckoutRequest(idempotency_key="cart-attempt"))
    assert cart_order.id != buy_now.id
    assert not any((i.selected_config or {}).get("buy_now") for i in cart_order.items)


@pytest.mark.parametrize("changes", [{"status": "draft"}, {"currency": "USD"}, {"safety_review_status": "pending"}])
def test_an_unavailable_product_cannot_be_bought_directly(payment_db, changes):
    service = payments()
    user, _ = seed_cart(payment_db)
    other = second_product(payment_db, user.id, **changes)
    with pytest.raises(HTTPException) as failure:
        service.prepare_order(payment_db, user, direct(other.id))
    assert failure.value.status_code == 409


def test_an_unknown_product_is_a_404(payment_db):
    service = payments()
    user, _ = seed_cart(payment_db)
    with pytest.raises(HTTPException) as failure:
        service.prepare_order(payment_db, user, direct(99999))
    assert failure.value.status_code == 404


def test_a_physical_direct_order_still_needs_a_valid_address(payment_db):
    service = payments()
    user, cart_product = seed_cart(payment_db)
    with pytest.raises(HTTPException) as failure:
        service.prepare_order(payment_db, user, direct(cart_product.id, kind="physical"))
    assert failure.value.status_code == 400


def test_a_cart_line_cannot_claim_to_be_buy_now(payment_db):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    from app.models.cart import CartItem
    user, _ = seed_cart(payment_db)
    payment_db.query(CartItem).one().selected_config = {"purchase_type": "digital", "buy_now": True}
    payment_db.commit()
    order = service.prepare_order(payment_db, user, CheckoutRequest(idempotency_key="cart-attempt"))
    assert not any((i.selected_config or {}).get("buy_now") for i in order.items)


def test_the_direct_item_rejects_bad_quantities_and_options():
    from app.api.routers.checkout import DirectItem
    for bad in ({"quantity": 0}, {"quantity": 101}, {"purchase_type": "download"}):
        with pytest.raises(ValidationError):
            DirectItem(**{"product_id": 1, "purchase_type": "digital", **bad})


def test_the_internal_buy_now_flag_never_reaches_any_page():
    from types import SimpleNamespace as NS
    from app.schemas.order import CustomerOrderItemResponse, OrderItemResponse, public_config
    config = {"purchase_type": "physical", "color": "Red", "buy_now": True}
    assert public_config(config) == {"purchase_type": "physical", "color": "Red"}
    assert public_config(None) is None and public_config({}) == {}
    assert config["buy_now"] is True  # the stored value is not modified
    row = NS(id=1, order_id=2, product_id=3, price_at_purchase=1.0, quantity=1, selected_config=config, product=None)
    for schema in (OrderItemResponse, CustomerOrderItemResponse):
        assert "buy_now" not in schema.model_validate(row, from_attributes=True).selected_config
