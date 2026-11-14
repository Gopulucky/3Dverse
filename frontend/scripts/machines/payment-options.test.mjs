import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/payment-options.ts');

test('UPI is the first payment block, then cards, netbanking and wallets', () => {
  const display = m.upiFirstDisplay();
  assert.deepEqual(display.sequence, ['block.upi_block', 'block.other_block']);
  assert.deepEqual(display.blocks.upi_block.instruments, [{ method: 'upi' }]);
  assert.deepEqual(display.blocks.other_block.instruments.map((i) => i.method), ['card', 'netbanking', 'wallet']);
  assert.equal(display.preferences.show_default_blocks, false);
});

test('each call returns a fresh object, so one checkout cannot alter the next', () => {
  const first = m.upiFirstDisplay();
  first.blocks.upi_block.name = 'changed';
  assert.notEqual(m.upiFirstDisplay().blocks.upi_block.name, 'changed');
});

test('phones use the redirect flow (the browser may be left for a UPI app); desktops use the popup', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
  assert.equal(m.usesRedirectFlow(android), true);
  assert.equal(m.usesRedirectFlow(iphone), true);
  assert.equal(m.usesRedirectFlow(desktop), false);
  assert.equal(m.usesRedirectFlow(''), false);
});

test('holdSecondsLeft counts down to zero and never goes negative or NaN', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(m.holdSecondsLeft('2026-11-14T10:14:05Z', now), 845);
  assert.equal(m.holdSecondsLeft('2026-11-14T10:00:00Z', now), 0);
  assert.equal(m.holdSecondsLeft('2026-11-14T09:00:00Z', now), 0);
  assert.equal(m.holdSecondsLeft('not a date', now), 0);
  assert.equal(m.holdSecondsLeft('2026-11-14T10:00:00.900Z', now), 0, 'a fraction of a second is not a second left');
});

test('formatCountdown shows minutes and zero-padded seconds', () => {
  assert.equal(m.formatCountdown(845), '14:05');
  assert.equal(m.formatCountdown(59), '0:59');
  assert.equal(m.formatCountdown(0), '0:00');
  assert.equal(m.formatCountdown(-5), '0:00');
  assert.equal(m.formatCountdown(3599), '59:59');
});

test('checkoutTimeout keeps the Razorpay window between one minute and the hold length', () => {
  assert.equal(m.checkoutTimeout(845), 845);
  assert.equal(m.checkoutTimeout(30), 60);
  assert.equal(m.checkoutTimeout(5000), 900);
  assert.equal(m.checkoutTimeout(0), 0, 'an ended hold cannot be paid');
});
