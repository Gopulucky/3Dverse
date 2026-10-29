"""Offline regressions for private assets and physical fulfilment."""
import asyncio
import io
from datetime import datetime, timedelta
from types import SimpleNamespace as NS

import pytest
from fastapi import HTTPException
from botocore.exceptions import BotoCoreError
from starlette.datastructures import UploadFile
from sqlalchemy.sql import operators
from sqlalchemy.sql.elements import BindParameter, BooleanClauseList, Null

import app.main  # register models without connecting a database
from app.api.routers import downloads, partner, commissions, collaboration
from app.core import shiprocket, storage
from app.core.config import settings
from app.models.user import UserRole, CreatorType
from app.models.collaboration import PaymentStatus, AgreementStatus
from app.services import returns, stock


class Query:
    def __init__(self, rows):
        self.rows = rows
    def filter(self, *expressions):
        for expression in expressions:
            key, value = expression.left.key, expression.right.value
            self.rows = [row for row in self.rows if getattr(row, key) == value]
        return self
    def first(self):
        return self.rows[0] if self.rows else None
    def with_for_update(self):
        return self


class DB:
    def __init__(self, *rows):
        self.rows, self.commits = rows, 0
    def query(self, model):
        return Query(list(self.rows))
    def add(self, row):
        pass
    def commit(self):
        self.commits += 1
    def refresh(self, row):
        pass


@pytest.mark.parametrize('user_id,role,want', [
    (42, UserRole.print_partner, True), (7, UserRole.customer, False),
    (7, UserRole.print_partner, False), (42, UserRole.customer, False),
    (91, UserRole.creator, True), (1, UserRole.admin, True),
])
def test_ticket_download_checks_linked_partner_user(user_id, role, want):
    ticket = NS(creator_id=91, print_partner_id=7)
    db = DB(NS(id=7, user_id=42), NS(id=8, user_id=7))
    assert downloads._ticket_party(db, ticket, NS(id=user_id, role=role)) is want


@pytest.mark.parametrize('currency,verified,want', [('INR',False,False), ('INR',True,True), ('USD',False,True)])
def test_partner_product_download_requires_verified_inr_payment(currency, verified, want):
    # No SQLite module is available in this runtime. Evaluate the emitted SQL
    # predicate against a joined fixture, with hand-derived allow/deny cases.
    row = dict(print_partner_id=2, product_id=4, currency=currency,
               payment_verified_at=datetime.utcnow() if verified else None, status='paid')
    def evaluate(expression):
        if isinstance(expression, BindParameter):
            return expression.value
        if isinstance(expression, Null):
            return None
        if isinstance(expression, BooleanClauseList):
            results = [evaluate(clause) for clause in expression.clauses]
            return any(results) if expression.operator is operators.or_ else all(results)
        if hasattr(expression, 'left'):
            left, right = evaluate(expression.left), evaluate(expression.right)
            if expression.operator is operators.not_in_op:
                return left not in right
            if expression.operator is operators.is_not:
                return left is not right
            return expression.operator(left, right)
        if hasattr(expression, 'element'):
            return evaluate(expression.element)
        return row[expression.key]
    class EntitlementQuery:
        def join(self, *args):
            return self
        def filter(self, *expressions):
            self.allowed = all(evaluate(expression) for expression in expressions)
            return self
        def first(self):
            return (11,) if self.allowed else None
    assert downloads._is_assigned_partner(NS(query=lambda *args: EntitlementQuery()), 2, 4) is want


@pytest.mark.parametrize('route', ['brief', 'design', 'ticket'])
def test_production_mock_payments_cannot_grant_paid_entitlements(monkeypatch, route):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(settings, 'ALLOW_MOCK_PAYMENTS', True)
    req = NS(id=5, customer_id=3, creator_id=3, payment_status=PaymentStatus.PENDING,
             design_fee_status=PaymentStatus.PENDING, workflow_status='pending_payment')
    db = DB(req)
    user = NS(id=3, role=UserRole.customer)
    if route == 'design':
        monkeypatch.setattr(commissions, '_load', lambda *args: req)
        db = DB(NS(status=AgreementStatus.ACTIVE, request_id=5))
    handler = {'brief': commissions.pay_brief_fee, 'design': commissions.pay_design_fee,
               'ticket': collaboration.pay_ticket}[route]
    with pytest.raises(HTTPException) as error:
        handler(5, db=db, current_user=user)
    assert error.value.status_code == 503
    assert req.payment_status == PaymentStatus.PENDING
    assert req.design_fee_status == PaymentStatus.PENDING
    assert db.commits == 0


def make_order(status='qc', **kwargs):
    values = dict(id=11, print_partner_id=2, status=status, currency='INR',
        payment_verified_at=datetime.utcnow(), created_at=datetime.utcnow()-timedelta(days=20),
        delivered_at=None, shipping_package=None, status_history=[],
        shiprocket_order_id=None, shiprocket_shipment_id=None, tracking_url=None,
        shipping_address=dict(name='Ada Rao', street='12 Park Road', city='Pune', state='Maharashtra',
                              zip='411001', country='IN', email='ada@example.org', phone='9876543210'),
        customer=NS(email='ada@example.org'), total=1200,
        items=[NS(product_id=4, quantity=1, price_at_purchase=1200,
                  selected_config={'purchase_type': 'physical'}, product=NS(title='Vase'))])
    values.update(kwargs)
    return NS(**values)


def update(order, status, **kwargs):
    db = DB(order)
    result = partner.update_job_status(order.id, partner.StatusUpdateRequest(status=status, **kwargs),
                                      db=db, current_user=NS(id=2, role=UserRole.print_partner))
    return result, db


@pytest.mark.parametrize('initial,target', [('paid','delivered'), ('pending_payment','queued'),
    ('queued','qc'), ('printing','queued'), ('qc','delivered'), ('delivered','shipped')])
def test_partner_rejects_skipped_or_backward_transitions(initial, target):
    order = make_order(initial)
    with pytest.raises(HTTPException) as error:
        update(order, target)
    assert error.value.status_code == 409
    assert order.status == initial


def test_unverified_inr_order_cannot_enter_fulfilment():
    order = make_order('paid', payment_verified_at=None)
    with pytest.raises(HTTPException) as error:
        update(order, 'queued')
    assert error.value.status_code == 409
    assert order.status == 'paid'


PACKAGE = dict(length_cm=15, breadth_cm=10, height_cm=8, weight_kg=0.4)


def test_failed_carrier_creation_does_not_mark_packed(monkeypatch):
    order = make_order()
    def fail(order):
        raise RuntimeError('carrier unavailable')
    monkeypatch.setattr(partner, 'create_shiprocket_order', fail)
    with pytest.raises(HTTPException) as error:
        update(order, 'packed', shipping_package=PACKAGE)
    assert error.value.status_code == 503
    assert order.status == 'qc'


def test_awb_retry_reuses_persisted_shipment_and_only_then_marks_packed(monkeypatch):
    order = make_order()
    creations = []
    def create(order):
        creations.append(order.id)
        return dict(order_id='501', shipment_id='601')
    def fail(shipment_id):
        raise RuntimeError('AWB temporarily unavailable')
    monkeypatch.setattr(partner, 'create_shiprocket_order', create)
    monkeypatch.setattr(partner, 'generate_awb', fail)
    with pytest.raises(HTTPException):
        update(order, 'packed', shipping_package=PACKAGE)
    assert order.status == 'qc'
    assert order.shiprocket_shipment_id == '601'
    monkeypatch.setattr(partner, 'generate_awb', lambda shipment_id: 'https://shiprocket.co/tracking/AWB123')
    result, _ = update(order, 'packed', shipping_package=PACKAGE)
    assert result.status == 'packed'
    assert result.tracking_url.endswith('AWB123')
    assert creations == [11]
    update(order, 'packed', shipping_package=PACKAGE)
    assert creations == [11]


def test_delivery_is_recorded_once_and_status_retry_is_idempotent():
    order = make_order('shipped', shiprocket_order_id='501', shiprocket_shipment_id='601',
                       tracking_url='https://shiprocket.co/tracking/AWB123')
    update(order, 'delivered')
    first_delivery = order.delivered_at
    assert isinstance(first_delivery, datetime)
    update(order, 'delivered')
    assert order.delivered_at == first_delivery
    assert len(order.status_history) == 1


def test_production_refuses_to_ship_a_development_mock_shipment(monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(partner, 'ship_order', lambda *args: None)
    order = make_order('packed', shiprocket_order_id='SR_ORDER_11', shiprocket_shipment_id='SR_SHIP_11',
                       tracking_url='https://tracking.mock.com/SR_SHIP_11')
    with pytest.raises(HTTPException) as error:
        update(order, 'shipped')
    assert error.value.status_code == 409
    assert order.status == 'packed'


def test_ambiguous_shipment_creation_cannot_be_blindly_retried_in_production(monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_EMAIL', 'merchant@example.org')
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_PASSWORD', 'configured')
    order = make_order()
    attempts = []
    def uncertain(order):
        attempts.append(order.id)
        raise shiprocket.CarrierUnavailable('carrier timed out after accepting the request')
    monkeypatch.setattr(partner, 'create_shiprocket_order', uncertain)
    for attempt in range(2):
        with pytest.raises(HTTPException):
            update(order, 'packed', shipping_package=PACKAGE)
    assert attempts == [11]
    assert order.status == 'qc'


@pytest.mark.parametrize('seller,days', [(True,7), (False,2)])
def test_return_deadline_starts_at_delivery_not_order_creation(seller, days):
    delivery = datetime.utcnow()-timedelta(days=1)
    product = NS(digital_download_enabled=False, is_mode_3_active=True,
                 creator=NS(creator_type=CreatorType.seller if seller else CreatorType.designer))
    order = make_order('delivered', delivered_at=delivery, defect_reported=False,
                       items=[NS(id=1, product_id=4, quantity=1, product=product)])
    policy = returns.order_return_policy(order)
    assert policy['window_closes_at'] == delivery+timedelta(days=days)
    assert policy['window_open'] is True


def test_returns_are_closed_before_delivery_and_for_undated_legacy_deliveries():
    product = NS(digital_download_enabled=False, is_mode_3_active=True, creator=None)
    for status in ['paid','shipped','delivered']:
        order = make_order(status, defect_reported=False,
                           items=[NS(id=1, product_id=4, quantity=1, product=product)])
        policy = returns.order_return_policy(order)
        assert policy['window_open'] is False
        assert policy['window_closes_at'] is None


@pytest.mark.parametrize('purchase_type,want', [('digital','digital_no_return'), ('physical','standard_return')])
def test_return_policy_uses_purchased_format_not_current_listing_switches(purchase_type, want):
    # A seller may offer the same design as a file and a finished object.
    product = NS(digital_download_enabled=True, is_mode_3_active=purchase_type == 'digital',
                 creator=NS(creator_type=CreatorType.seller))
    item = NS(id=1,product_id=4,quantity=1,product=product,selected_config={'purchase_type':purchase_type})
    order = make_order('delivered', delivered_at=datetime.utcnow(),defect_reported=False,items=[item])
    assert returns.order_return_policy(order)['items'][0]['policy'] == want


@pytest.mark.parametrize('operation', [stock.reserve_for_order, stock.release_for_order, stock.ship_order])
def test_digital_purchase_never_consumes_physical_stock(operation):
    inventory = NS(product_id=4, id=1, reserved=3, on_hand=5, sellable=2)
    order = make_order(items=[NS(product_id=4, quantity=1, selected_config={'purchase_type':'digital'})])
    operation(DB(inventory), order)
    assert inventory.reserved == 3
    assert inventory.on_hand == 5


@pytest.mark.parametrize('operation', ['token','order','awb'])
def test_production_never_returns_mock_shipping(monkeypatch, operation):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_EMAIL', 'mock')
    with pytest.raises(Exception):
        {'token': lambda: shiprocket.get_shiprocket_token(),
         'order': lambda: shiprocket.create_shiprocket_order(make_order(shipping_package=PACKAGE)),
         'awb': lambda: shiprocket.generate_awb('601')}[operation]()


@pytest.mark.parametrize('field,value', [('phone',''),('email','bad'),('name',''),('street',''),
    ('zip','000000'),('city',''),('state',''),('country','US')])
def test_carrier_rejects_invalid_recipient_before_network(monkeypatch, field, value):
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_EMAIL', 'merchant@example.org')
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_PASSWORD', 'configured')
    order = make_order(shipping_package=PACKAGE)
    order.shipping_address[field] = value
    monkeypatch.setattr(shiprocket.requests, 'post', lambda *a,**k: pytest.fail('invalid recipient reached network'))
    with pytest.raises(ValueError):
        shiprocket.create_shiprocket_order(order)


@pytest.mark.parametrize('field,value', [('length_cm',0),('breadth_cm',-1),('height_cm',float('nan')),('weight_kg',0)])
def test_carrier_rejects_invalid_parcel_before_network(monkeypatch, field, value):
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_EMAIL', 'merchant@example.org')
    parcel = dict(PACKAGE)
    parcel[field] = value
    monkeypatch.setattr(shiprocket.requests, 'post', lambda *a,**k: pytest.fail('invalid parcel reached network'))
    with pytest.raises(ValueError):
        shiprocket.create_shiprocket_order(make_order(shipping_package=parcel))


def test_real_carrier_payload_uses_recipient_parcel_and_bounded_timeouts(monkeypatch):
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_EMAIL', 'merchant@example.org')
    monkeypatch.setattr(shiprocket, 'SHIPROCKET_PASSWORD', 'configured')
    calls = []
    def post(url, **kwargs):
        calls.append((url,kwargs))
        data = {'token':'real_token'} if url.endswith('auth/login') else {'order_id':501,'shipment_id':601}
        return NS(status_code=200, json=lambda: data)
    monkeypatch.setattr(shiprocket.requests, 'post', post)
    result = shiprocket.create_shiprocket_order(make_order(shipping_package=PACKAGE))
    assert result == {'order_id':'501','shipment_id':'601'}
    payload = calls[1][1]['json']
    assert payload['billing_phone'] == '9876543210'
    assert payload['billing_email'] == 'ada@example.org'
    assert (payload['length'],payload['breadth'],payload['height'],payload['weight']) == (15,10,8,0.4)
    assert all(call[1].get('timeout') for call in calls)


@pytest.mark.parametrize('generated', [False,True])
@pytest.mark.parametrize('cloud_failure', [False,True])
def test_production_storage_never_reports_ephemeral_local_success(tmp_path, monkeypatch, generated, cloud_failure):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(storage, 'LOCAL_UPLOADS_DIR', str(tmp_path/'uploads'))
    class BrokenS3:
        def upload_file(self, *args, **kwargs):
            raise BotoCoreError()
    monkeypatch.setattr(storage, 'get_s3_client', lambda: BrokenS3() if cloud_failure else None)
    monkeypatch.setattr(storage, 'AWS_BUCKET_NAME', 'private-files')
    with pytest.raises(HTTPException) as error:
        if generated:
            source = tmp_path/'source.stl'
            source.write_bytes(b'model')
            storage.store_local_file(str(source), 'models', 'stl')
        else:
            asyncio.run(storage.save_upload_file(UploadFile(filename='model.stl', file=io.BytesIO(b'model'))))
    assert error.value.status_code == 503
    assert not list((tmp_path/'uploads').rglob('*.*'))
