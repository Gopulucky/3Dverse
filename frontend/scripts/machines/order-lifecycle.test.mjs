import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/order-lifecycle.ts');

test('orderPhase table', () => {
  assert.deepEqual(m.orderPhase('pending_payment'), { kind: 'awaiting_payment' });
  assert.deepEqual(m.orderPhase('pending'), { kind: 'awaiting_payment' });
  assert.deepEqual(m.orderPhase('paid'), { kind: 'fulfilment', index: 0 });
  assert.deepEqual(m.orderPhase('delivered'), { kind: 'fulfilment', index: 6 });
  assert.deepEqual(m.orderPhase('completed'), { kind: 'completed' });
  assert.deepEqual(m.orderPhase('cancelled'), { kind: 'closed', reason: 'cancelled' });
  assert.deepEqual(m.orderPhase('failed'), { kind: 'closed', reason: 'failed' });
  for (const s of ['refunded', '', undefined, null]) assert.deepEqual(m.orderPhase(s), { kind: 'unknown' });
});

test('labels and tones', () => {
  assert.equal(m.orderStatusLabel('pending_payment'), 'Awaiting payment');
  assert.equal(m.orderStatusLabel('qc'), 'Quality check');
  assert.equal(m.orderStatusLabel('on_hold'), 'on hold');
  assert.equal(m.orderStatusLabel(undefined), 'Unknown');
  assert.equal(m.orderStatusTone('shipped'), 'success');
  assert.equal(m.orderStatusTone('queued'), 'warning');
  assert.equal(m.orderStatusTone('qc'), 'in-progress');
  assert.equal(m.orderStatusTone('cancelled'), 'neutral');
});

test('paid and admin-open sets', () => {
  assert.equal(m.isPaidStatus('completed'), true);
  assert.equal(m.isPaidStatus('pending_payment'), false);
  assert.equal(m.isPaidStatus(undefined), false);
  assert.deepEqual([...m.ADMIN_OPEN_STATUSES].sort(), ['paid', 'pending', 'printing', 'queued']);
});

test('NEXT_STATUS matches backend partner.py', () => {
  const py = readFileSync(new URL('../../../backend/app/api/routers/partner.py', import.meta.url), 'utf8');
  const body = py.match(/NEXT_STATUS\s*=\s*\{([^}]*)\}/s)[1];
  const backend = Object.fromEntries([...body.matchAll(/"(\w+)"\s*:\s*"(\w+)"/g)].map((x) => [x[1], x[2]]));
  assert.deepEqual({ ...m.NEXT_STATUS }, backend);
});

test('UNPAID_STATUSES matches backend order.py', () => {
  const py = readFileSync(new URL('../../../backend/app/models/order.py', import.meta.url), 'utf8');
  const backend = [...py.match(/UNPAID_STATUSES\s*=\s*\{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual([...m.UNPAID_STATUSES].sort(), backend);
});

test('flow is the NEXT_STATUS chain', () => {
  for (let i = 0; i < m.FULFILLMENT_FLOW.length - 1; i++) {
    assert.equal(m.NEXT_STATUS[m.FULFILLMENT_FLOW[i]], m.FULFILLMENT_FLOW[i + 1]);
  }
});
