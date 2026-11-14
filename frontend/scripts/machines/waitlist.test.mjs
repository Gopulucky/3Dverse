import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/waitlist.ts');
const w = await loadTs('src/lib/waitlist.ts');
const run = (...events) => events.reduce(m.waitlistReducer, m.initialWaitlistState);

test('starts idle', () => {
  assert.deepEqual(m.initialWaitlistState, { status: 'idle' });
});

test('SUBMIT -> submitting -> joined', () => {
  assert.deepEqual(run({ type: 'SUBMIT' }), { status: 'submitting' });
  assert.deepEqual(run({ type: 'SUBMIT' }, { type: 'JOINED' }), { status: 'joined' });
});

test('a failure keeps the form and allows a retry', () => {
  const failed = run({ type: 'SUBMIT' }, { type: 'FAILED', message: 'Try again' });
  assert.deepEqual(failed, { status: 'error', message: 'Try again' });
  assert.deepEqual(m.waitlistReducer(failed, { type: 'SUBMIT' }), { status: 'submitting' });
});

test('double submits and late responses are ignored', () => {
  const submitting = run({ type: 'SUBMIT' });
  assert.equal(m.waitlistReducer(submitting, { type: 'SUBMIT' }), submitting);
  const joined = run({ type: 'SUBMIT' }, { type: 'JOINED' });
  assert.equal(m.waitlistReducer(joined, { type: 'SUBMIT' }), joined);
  assert.equal(m.waitlistReducer(joined, { type: 'FAILED', message: 'x' }), joined);
  const idle = run();
  assert.equal(m.waitlistReducer(idle, { type: 'JOINED' }), idle);
});

test('validation needs an email, an interest and consent', () => {
  assert.deepEqual(w.validateWaitlist({ email: '', interest: '', consent: false }), {
    email: 'Enter your email address.',
    interest: 'Choose what you would buy.',
    consent: 'Tick the box so we can email you at launch.',
  });
  assert.deepEqual(w.validateWaitlist({ email: 'a@b', interest: 'tabletop', consent: true }), { email: 'Enter a valid email address.' });
  assert.deepEqual(w.validateWaitlist({ email: ' a@b.co ', interest: 'tabletop', consent: true }), {});
});

test('payload trims, lowercases and drops blank optional answers', () => {
  assert.deepEqual(
    w.waitlistPayload({ email: ' A@B.co ', interest: 'tabletop', priceChoice: '', city: '  ', consent: true }, 'home'),
    { email: 'a@b.co', interest: 'tabletop', price_choice: null, city: null, consent: true, source: 'home' },
  );
  assert.deepEqual(
    w.waitlistPayload({ email: 'a@b.co', interest: 'cosplay', priceChoice: '499', city: ' Pune ', consent: true }, 'printed_catalogue'),
    { email: 'a@b.co', interest: 'cosplay', price_choice: '499', city: 'Pune', consent: true, source: 'printed_catalogue' },
  );
});

test('answer options match the backend schema', () => {
  const schema = readFileSync(new URL('../../../backend/app/schemas/waitlist.py', import.meta.url), 'utf8');
  const literal = (name) => [...schema.match(new RegExp(`${name} = Literal\\[([^\\]]+)\\]`))[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(w.INTERESTS.map((o) => o.value), literal('Interest'));
  assert.deepEqual(w.PRICE_CHOICES.map((o) => o.value), literal('PriceChoice'));
});

test('CSV export quotes values and defuses spreadsheet formulas', () => {
  const csv = w.waitlistCsv([
    { email: 'a@b.co', interest: 'tabletop', price_choice: '499', city: 'Pune, MH', source: 'home', created_at: '2026-11-14T10:00:00' },
    { email: 'c@d.co', interest: 'other', price_choice: null, city: '=HYPERLINK("x")', source: 'home', created_at: null },
  ]);
  assert.equal(csv.split('\r\n')[0], 'email,interest,price_choice,city,source,created_at');
  assert.equal(csv.split('\r\n')[1], 'a@b.co,tabletop,499,"Pune, MH",home,2026-11-14T10:00:00');
  assert.equal(csv.split('\r\n')[2], 'c@d.co,other,,"\'=HYPERLINK(""x"")",home,');
});
