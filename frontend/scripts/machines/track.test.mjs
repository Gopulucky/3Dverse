import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const t = await loadTs('src/lib/track.ts');
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
};
const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const setup = (overrides = {}) => {
  const sent = [];
  const tracker = t.createTracker({ local: memory(), session: memory(), search: '', send: (batch) => { sent.push(batch); }, ...overrides });
  return { tracker, sent };
};

test('src wins over utm_source and unknown parameters are ignored', () => {
  assert.deepEqual(t.parseSource('?src=ig_story&utm_source=google&utm_medium=cpc&utm_campaign=launch&x=1'),
    { source: 'ig_story', medium: 'cpc', campaign: 'launch' });
  assert.deepEqual(t.parseSource('?utm_source=whatsapp'), { source: 'whatsapp', medium: null, campaign: null });
});

test('junk, overlong or empty values become nothing', () => {
  for (const search of ['', '?src=', '?src=a b', '?src=<b>', `?src=${'x'.repeat(65)}`, '?src=%E0%A4%A']) {
    assert.deepEqual(t.parseSource(search), { source: null, medium: null, campaign: null }, search);
  }
});

test('anon ids are random and match the server pattern', () => {
  const a = t.newAnonId();
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/);
  assert.notEqual(a, t.newAnonId());
});

test('an event carries the visitor id, product and first-touch source', () => {
  const { tracker, sent } = setup({ search: '?src=ig_story&utm_medium=social' });
  tracker.track('product_view', { productId: 5, path: '/marketplace/5' });
  assert.equal(sent.length, 1);
  assert.match(sent[0].anon_id, /^[A-Za-z0-9_-]{8,64}$/);
  assert.deepEqual(sent[0].events, [{ event: 'product_view', product_id: 5, source: 'ig_story', medium: 'social', campaign: null, path: '/marketplace/5' }]);
});

test('the visitor id and the first source persist across page loads', () => {
  const local = memory();
  const first = setup({ local, search: '?src=whatsapp' });
  first.tracker.track('landing');
  const second = setup({ local, search: '?src=instagram' }); // a later link must not overwrite the first touch
  second.tracker.track('landing');
  assert.equal(second.sent[0].anon_id, first.sent[0].anon_id);
  assert.equal(second.sent[0].events[0].source, 'whatsapp');
});

test('a visitor who arrives directly stays direct until a source shows up', () => {
  const local = memory();
  const direct = setup({ local });
  direct.tracker.track('landing');
  assert.equal(direct.sent[0].events[0].source, null);
  const later = setup({ local, search: '?src=reel' });
  later.tracker.track('product_view');
  assert.equal(later.sent[0].events[0].source, 'reel');
});

test('landing is sent once per browsing session', () => {
  const { tracker, sent } = setup();
  tracker.landing('/');
  tracker.landing('/marketplace');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events[0].event, 'landing');
});

test('checkout attribution is the visitor id plus source, or undefined without storage', () => {
  const { tracker } = setup({ search: '?src=ig' });
  assert.deepEqual({ ...tracker.visitor(), anon_id: 'x' }, { anon_id: 'x', source: 'ig', medium: null, campaign: null });
  assert.equal(setup({ local: blocked, session: blocked }).tracker.visitor() != null, true); // still gets an in-memory id
});

test('tracking never throws: blocked storage and a failing sender are both fine', () => {
  const { tracker } = setup({ local: blocked, session: blocked });
  assert.doesNotThrow(() => tracker.track('buy_now', { productId: 1 }));
  const failing = setup({ send: () => { throw new Error('offline'); } });
  assert.doesNotThrow(() => failing.tracker.track('add_to_cart'));
  const rejecting = setup({ send: () => Promise.reject(new Error('offline')) });
  assert.doesNotThrow(() => rejecting.tracker.track('add_to_cart'));
});
