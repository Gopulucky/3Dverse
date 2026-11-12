import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { summarizeCart, withQuantity, unitPrice, MAX_QUANTITY } = await loadTs('src/lib/cart-summary.ts');

const product = { id: 1, title: 'Bracket', price: 100, base_print_price: 300, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true, is_mode_3_active: true };
const line = (id, quantity, purchase_type, over = {}) => ({ id, quantity, selected_config: purchase_type ? { purchase_type } : null, product: { ...product, id, ...over } });

test('prices each line by its chosen format', () => {
  assert.equal(unitPrice(line(1, 1, 'digital')), 100);
  assert.equal(unitPrice(line(1, 1, 'physical')), 300);
  assert.equal(unitPrice(line(1, 1, undefined)), undefined);
});

test('sums quantities and totals', () => {
  const s = summarizeCart([line(1, 2, 'digital'), line(2, 1, 'physical')], null);
  assert.equal(s.itemCount, 3);
  assert.equal(s.subtotal, 500);
  assert.equal(s.discount, 0);
  assert.equal(s.total, 500);
  assert.equal(s.currency, 'INR');
  assert.equal(s.issue, null);
  assert.equal(s.canCheckout, true);
});

test('percent and flat coupons never take the total below zero', () => {
  const lines = [line(1, 1, 'digital')];
  assert.equal(summarizeCart(lines, { code: 'TEN', percent_off: 10 }).discount, 10);
  assert.equal(summarizeCart(lines, { code: 'TEN', percent_off: 10 }).total, 90);
  assert.equal(summarizeCart(lines, { code: 'BIG', flat_off: 500 }).discount, 100);
  assert.equal(summarizeCart(lines, { code: 'BIG', flat_off: 500 }).total, 0);
  assert.equal(summarizeCart(lines, { code: 'ODD', percent_off: 250 }).total, 0);
});

test('a missing format blocks checkout and names the problem', () => {
  const s = summarizeCart([line(1, 1, undefined)], null);
  assert.equal(s.issue, 'needs_format');
  assert.equal(s.canCheckout, false);
  assert.equal(s.total, null, 'no total is invented for an unpriced line');
});

test('mixed or non-INR carts cannot be checked out', () => {
  assert.equal(summarizeCart([line(1, 1, 'digital'), line(2, 1, 'digital', { currency: 'USD' })], null).issue, 'mixed_currency');
  const usd = summarizeCart([line(1, 1, 'digital', { currency: 'USD' })], null);
  assert.equal(usd.issue, 'non_inr');
  assert.equal(usd.canCheckout, false);
});

test('an empty cart has nothing to check out', () => {
  const s = summarizeCart([], null);
  assert.equal(s.itemCount, 0);
  assert.equal(s.canCheckout, false);
  assert.equal(s.total, 0);
});

test('withQuantity changes one line, drops it at zero and clamps the top', () => {
  const lines = [line(1, 2, 'digital'), line(2, 1, 'digital')];
  assert.equal(withQuantity(lines, 1, 5)[0].quantity, 5);
  assert.deepEqual(withQuantity(lines, 1, 0).map((l) => l.id), [2]);
  assert.equal(withQuantity(lines, 2, 999)[1].quantity, MAX_QUANTITY);
  assert.equal(lines[0].quantity, 2, 'input is not mutated');
});
