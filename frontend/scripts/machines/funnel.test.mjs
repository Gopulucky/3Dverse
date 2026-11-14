import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const f = await loadTs('src/lib/funnel.ts');

test('share of visitors is a whole percent, or null before anyone has visited', () => {
  assert.equal(f.shareOfVisitors(1, 3), 33);
  assert.equal(f.shareOfVisitors(3, 3), 100);
  assert.equal(f.shareOfVisitors(0, 4), 0);
  assert.equal(f.shareOfVisitors(0, 0), null);
});

test('every step the server reports has a plain-language label', () => {
  for (const step of ['landing', 'product_view', 'viewer_opened', 'add_to_cart', 'buy_now', 'checkout_started', 'payment_opened', 'paid', 'waitlist_joined']) {
    assert.ok(f.STEP_LABELS[step], step);
  }
});
