import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/audience-popup.ts');
const s = await loadTs('src/lib/audience-schedule.ts');
const run = (...events) => events.reduce(m.audiencePopupReducer, m.initialAudiencePopupState);
const memory = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
};
const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

test('starts closed; OPEN shows step 1', () => {
  assert.deepEqual(m.initialAudiencePopupState, { status: 'closed' });
  assert.deepEqual(run({ type: 'OPEN' }), { status: 'open', step: 1, error: '' });
});

test('NEXT and BACK move between the four steps and stop at the ends', () => {
  assert.equal(run({ type: 'OPEN' }, { type: 'NEXT' }).step, 2);
  assert.equal(run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }).step, 4);
  const last = run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
  assert.equal(m.audiencePopupReducer(last, { type: 'NEXT' }), last);
  const first = run({ type: 'OPEN' });
  assert.equal(m.audiencePopupReducer(first, { type: 'BACK' }), first);
  assert.equal(run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'BACK' }).step, 1);
});

test('SUBMIT only works on the last step; success finishes, failure returns with a message', () => {
  const second = run({ type: 'OPEN' }, { type: 'NEXT' });
  assert.equal(m.audiencePopupReducer(second, { type: 'SUBMIT' }), second);
  const last = run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
  const submitting = m.audiencePopupReducer(last, { type: 'SUBMIT' });
  assert.deepEqual(submitting, { status: 'submitting' });
  assert.deepEqual(m.audiencePopupReducer(submitting, { type: 'SUBMITTED' }), { status: 'done' });
  assert.deepEqual(m.audiencePopupReducer(submitting, { type: 'SUBMIT_FAILED', error: 'Try again' }), { status: 'open', step: 4, error: 'Try again' });
});

test('double submits and late events change nothing', () => {
  const last = run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
  const submitting = m.audiencePopupReducer(last, { type: 'SUBMIT' });
  assert.equal(m.audiencePopupReducer(submitting, { type: 'SUBMIT' }), submitting);
  assert.equal(m.audiencePopupReducer(submitting, { type: 'CLOSE' }), submitting); // cannot close mid-save
  const closed = run();
  assert.equal(m.audiencePopupReducer(closed, { type: 'SUBMITTED' }), closed);
  assert.equal(m.audiencePopupReducer(closed, { type: 'NEXT' }), closed);
  const done = m.audiencePopupReducer(submitting, { type: 'SUBMITTED' });
  assert.equal(m.audiencePopupReducer(done, { type: 'OPEN' }), done);
});

test('CLOSE works from an open step and from done', () => {
  assert.deepEqual(run({ type: 'OPEN' }, { type: 'CLOSE' }), { status: 'closed' });
  const last = run({ type: 'OPEN' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
  const done = m.audiencePopupReducer(m.audiencePopupReducer(last, { type: 'SUBMIT' }), { type: 'SUBMITTED' });
  assert.deepEqual(m.audiencePopupReducer(done, { type: 'CLOSE' }), { status: 'closed' });
});

test('only storefront pages may show the popup', () => {
  for (const path of ['/', '/marketplace', '/marketplace/12', '/marketplace/home']) assert.equal(s.pageAllowed(path), true, path);
  for (const path of ['/checkout', '/checkout/return', '/login', '/register', '/admin/funnel', '/creator/dashboard', '/partner', '/orders', '/cart', '/settings', '/marketplaceX']) {
    assert.equal(s.pageAllowed(path), false, path);
  }
});

test('it opens after 15 seconds or a second product page, never while snoozed or on a blocked page', () => {
  const base = { pathname: '/', productViews: 0, elapsedMs: 0, snoozed: false };
  assert.equal(s.shouldOpen(base), false);
  assert.equal(s.shouldOpen({ ...base, elapsedMs: s.OPEN_DELAY_MS - 1 }), false);
  assert.equal(s.shouldOpen({ ...base, elapsedMs: s.OPEN_DELAY_MS }), true);
  assert.equal(s.shouldOpen({ ...base, productViews: 1 }), false);
  assert.equal(s.shouldOpen({ ...base, productViews: 2 }), true);
  assert.equal(s.shouldOpen({ ...base, productViews: 2, snoozed: true }), false);
  assert.equal(s.shouldOpen({ ...base, elapsedMs: 60_000, pathname: '/checkout' }), false);
});

test('closing snoozes for 14 days, finishing for a year; storage trouble means no popup', () => {
  const store = memory();
  const now = Date.UTC(2026, 10, 14);
  assert.equal(s.isSnoozed(store, now), false);
  s.snooze(store, now, s.SNOOZE_DAYS_CLOSED);
  assert.equal(s.isSnoozed(store, now + 13 * 86_400_000), true);
  assert.equal(s.isSnoozed(store, now + 15 * 86_400_000), false);
  s.snooze(store, now, s.SNOOZE_DAYS_DONE);
  assert.equal(s.isSnoozed(store, now + 300 * 86_400_000), true);
  assert.equal(s.isSnoozed(memory({ '3dv_audience_until': 'garbage' }), now), false);
  assert.equal(s.isSnoozed(blocked, now), true); // cannot remember a refusal, so never nag
  assert.doesNotThrow(() => s.snooze(blocked, now, 14));
});

test('distinct product pages are counted once per session', () => {
  const store = memory();
  assert.equal(s.addProductView(store, '/marketplace/5'), 1);
  assert.equal(s.addProductView(store, '/marketplace/5'), 1);
  assert.equal(s.addProductView(store, '/marketplace/6'), 2);
  assert.equal(s.addProductView(store, '/marketplace'), 2);
  assert.equal(s.addProductView(store, '/'), 2);
  assert.equal(s.addProductView(blocked, '/marketplace/5'), 0);
});
