import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/checkout.ts');
const order = { order_id: 5, payment_status: 'requires_payment_method' };

test('page machine: happy path editing -> preparing -> payment', () => {
  let s = m.initialCheckoutState;
  assert.deepEqual(s, { status: 'editing', error: '' });
  s = m.checkoutReducer(s, { type: 'PREPARE' });
  assert.deepEqual(s, { status: 'preparing' });
  s = m.checkoutReducer(s, { type: 'PREPARED', checkout: order });
  assert.deepEqual(s, { status: 'payment', checkout: order });
});

test('page machine: PREPARE_FAILED returns to editing with the error', () => {
  const s = [{ type: 'PREPARE' }, { type: 'PREPARE_FAILED', error: 'bad pin' }].reduce(m.checkoutReducer, m.initialCheckoutState);
  assert.deepEqual(s, { status: 'editing', error: 'bad pin' });
});

test('PREPARE clears a previous error', () => {
  const failed = { status: 'editing', error: 'old' };
  assert.deepEqual(m.checkoutReducer(failed, { type: 'PREPARE' }), { status: 'preparing' });
});

test('ignores events out of order (same object returned)', () => {
  const preparing = m.checkoutReducer(m.initialCheckoutState, { type: 'PREPARE' });
  assert.equal(m.checkoutReducer(preparing, { type: 'PREPARE' }), preparing);
  const payment = m.checkoutReducer(preparing, { type: 'PREPARED', checkout: order });
  assert.equal(m.checkoutReducer(payment, { type: 'PREPARE_FAILED', error: 'late' }), payment);
  assert.equal(m.checkoutReducer(payment, { type: 'PREPARED', checkout: { ...order, order_id: 9 } }), payment);
  assert.equal(m.checkoutReducer(payment, { type: 'PREPARE' }), payment);
  assert.equal(m.checkoutReducer(m.initialCheckoutState, { type: 'PREPARED', checkout: order }), m.initialCheckoutState);
});

test('payment machine: confirmed path', () => {
  const steps = [{ type: 'CONFIRM' }, { type: 'SUBMITTED' }, { type: 'VERIFIED' }];
  const states = [];
  steps.reduce((s, e) => { const n = m.paymentReducer(s, e); states.push(n.status); return n; }, m.initialPaymentState);
  assert.deepEqual(states, ['confirming', 'verifying', 'confirmed']);
});

test('payment machine: TIMED_OUT -> pending, FAILED -> unknown', () => {
  const verifying = [{ type: 'CONFIRM' }, { type: 'SUBMITTED' }].reduce(m.paymentReducer, m.initialPaymentState);
  assert.equal(m.paymentReducer(verifying, { type: 'TIMED_OUT' }).status, 'pending');
  assert.equal(m.paymentReducer(verifying, { type: 'FAILED' }).status, 'unknown');
  const confirming = m.paymentReducer(m.initialPaymentState, { type: 'CONFIRM' });
  assert.equal(m.paymentReducer(confirming, { type: 'FAILED' }).status, 'unknown');
});

test('payment machine: STRIPE_ERROR returns to idle with the message and allows a retry', () => {
  const confirming = m.paymentReducer(m.initialPaymentState, { type: 'CONFIRM' });
  const idle = m.paymentReducer(confirming, { type: 'STRIPE_ERROR', error: 'Card declined' });
  assert.deepEqual(idle, { status: 'idle', error: 'Card declined' });
  assert.equal(m.paymentReducer(idle, { type: 'CONFIRM' }).status, 'confirming');
});

test('payment machine ignores out-of-order events', () => {
  const verifying = [{ type: 'CONFIRM' }, { type: 'SUBMITTED' }].reduce(m.paymentReducer, m.initialPaymentState);
  assert.equal(m.paymentReducer(verifying, { type: 'CONFIRM' }), verifying);
  assert.equal(m.paymentReducer(verifying, { type: 'STRIPE_ERROR', error: 'x' }), verifying);
  assert.equal(m.paymentReducer(m.initialPaymentState, { type: 'VERIFIED' }), m.initialPaymentState);
  const confirmed = m.paymentReducer(verifying, { type: 'VERIFIED' });
  assert.equal(m.paymentReducer(confirmed, { type: 'TIMED_OUT' }), confirmed);
});

test('paymentFinished and paymentMessage', () => {
  const at = (...events) => events.reduce(m.paymentReducer, m.initialPaymentState);
  assert.equal(m.paymentFinished(at()), false);
  assert.equal(m.paymentFinished(at({ type: 'CONFIRM' })), false);
  assert.equal(m.paymentFinished(at({ type: 'CONFIRM' }, { type: 'SUBMITTED' })), true);
  assert.equal(m.paymentMessage(at()), '');
  assert.equal(m.paymentMessage(at({ type: 'CONFIRM' })), '');
  assert.equal(m.paymentMessage({ status: 'idle', error: 'Card declined' }), 'Card declined');
  assert.equal(m.paymentMessage(at({ type: 'CONFIRM' }, { type: 'SUBMITTED' })), 'Payment submitted. Waiting for secure confirmation for your saved order.');
  assert.equal(m.paymentMessage(at({ type: 'CONFIRM' }, { type: 'SUBMITTED' }, { type: 'VERIFIED' })), 'Payment confirmed. Your order is ready to view.');
  assert.equal(m.paymentMessage(at({ type: 'CONFIRM' }, { type: 'SUBMITTED' }, { type: 'TIMED_OUT' })), 'Your order is saved and payment confirmation is pending. Check Orders for updates before trying another payment.');
  assert.equal(m.paymentMessage(at({ type: 'CONFIRM' }, { type: 'FAILED' })), 'We could not confirm the latest payment status. Your order is saved. Check Orders before trying another payment.');
});

test('checkoutViewState priority table', () => {
  const base = { ready: true, isPending: false, isError: false, paymentsAvailable: true, state: m.initialCheckoutState };
  const v = (o) => m.checkoutViewState({ ...base, ...o });
  assert.equal(v({ ready: false }), 'loading');
  assert.equal(v({ isPending: true }), 'loading');
  assert.equal(v({ isError: true }), 'load-error');
  assert.equal(v({ paymentsAvailable: false }), 'unavailable');
  assert.equal(v({}), 'editing');
  assert.equal(v({ state: { status: 'preparing' } }), 'preparing');
  assert.equal(v({ state: { status: 'payment', checkout: order } }), 'payment');
  for (const payment_status of ['succeeded', 'processing', 'requires_capture']) {
    assert.equal(v({ state: { status: 'payment', checkout: { ...order, payment_status } } }), 'already-submitted');
  }
});
