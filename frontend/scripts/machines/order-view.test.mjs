import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { ORDER_FILTERS, orderFilter, filterOrders, filterCounts, orderHeadline, isDigitalOnly } = await loadTs('src/lib/order-view.ts');

const item = (purchase_type) => ({ id: 1, product_id: 1, quantity: 1, selected_config: purchase_type ? { purchase_type } : null });
const order = (id, status, ...types) => ({ id, status, items: types.length ? types.map(item) : [item('physical')] });

test('every status falls in exactly one filter', () => {
  assert.deepEqual(['paid', 'queued', 'printing', 'qc', 'packed', 'shipped', 'pending_payment', 'pending'].map(orderFilter),
    ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active']);
  assert.deepEqual(['delivered', 'completed'].map(orderFilter), ['delivered', 'delivered']);
  assert.deepEqual(['cancelled', 'failed'].map(orderFilter), ['cancelled', 'cancelled']);
  assert.equal(orderFilter('mystery'), 'active', 'an unknown status is still shown, never hidden');
});

test('filters list the right orders and count them', () => {
  const orders = [order(1, 'printing'), order(2, 'delivered'), order(3, 'cancelled'), order(4, 'pending_payment')];
  assert.deepEqual(filterOrders(orders, 'all').map((o) => o.id), [1, 2, 3, 4]);
  assert.deepEqual(filterOrders(orders, 'active').map((o) => o.id), [1, 4]);
  assert.deepEqual(filterOrders(orders, 'delivered').map((o) => o.id), [2]);
  assert.deepEqual(filterCounts(orders), { all: 4, active: 2, delivered: 1, cancelled: 1 });
  assert.deepEqual(ORDER_FILTERS.map((f) => f.id), ['all', 'active', 'delivered', 'cancelled']);
});

test('digital-only orders are recognised', () => {
  assert.equal(isDigitalOnly(order(1, 'paid', 'digital', 'digital')), true);
  assert.equal(isDigitalOnly(order(1, 'paid', 'digital', 'physical')), false);
  assert.equal(isDigitalOnly({ id: 1, status: 'paid', items: [] }), false);
});

test('headline tells the buyer what is happening, in plain words', () => {
  assert.match(orderHeadline(order(1, 'paid', 'digital')).title, /ready to download/i);
  assert.match(orderHeadline(order(1, 'printing')).title, /being printed/i);
  assert.match(orderHeadline(order(1, 'shipped')).title, /on the way/i);
  assert.match(orderHeadline(order(1, 'delivered')).title, /delivered/i);
  assert.match(orderHeadline(order(1, 'pending_payment')).title, /payment/i);
  assert.match(orderHeadline(order(1, 'cancelled')).title, /cancelled/i);
  assert.equal(orderHeadline(order(1, 'printing')).tone, 'in-progress');
});

test('headline carries progress for printed orders only', () => {
  assert.deepEqual(orderHeadline(order(1, 'printing')).progress, { step: 3, of: 7 });
  assert.equal(orderHeadline(order(1, 'paid', 'digital')).progress, null);
  assert.equal(orderHeadline(order(1, 'cancelled')).progress, null);
});
