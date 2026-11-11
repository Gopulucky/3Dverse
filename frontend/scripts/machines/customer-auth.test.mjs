import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { authReducer, initialAuthState, isLegacy } = await loadTs('src/lib/machines/customer-auth.ts');
const run = (state, ...events) => events.reduce(authReducer, state);
const email = initialAuthState;
const legacy = run(email, { type: 'TOGGLE_LEGACY' });

test('starts idle in email mode', () => {
  assert.deepEqual(initialAuthState, { mode: { kind: 'email' }, status: 'idle', error: '' });
});

test('SUBMIT moves idle to submitting and clears the error', () => {
  const failed = { ...email, error: 'old' };
  assert.deepEqual(authReducer(failed, { type: 'SUBMIT' }), { mode: { kind: 'email' }, status: 'submitting', error: '' });
});

test('SUBMIT while submitting is ignored (same object)', () => {
  const submitting = authReducer(email, { type: 'SUBMIT' });
  assert.equal(authReducer(submitting, { type: 'SUBMIT' }), submitting);
});

test('FAILED returns to idle with the message and keeps the mode', () => {
  const s = run(legacy, { type: 'SUBMIT' }, { type: 'FAILED', error: 'nope' });
  assert.deepEqual(s, { mode: { kind: 'legacy' }, status: 'idle', error: 'nope' });
});

test('FAILED while idle is ignored', () => {
  assert.equal(authReducer(email, { type: 'FAILED', error: 'x' }), email);
});

test('LINK_REQUIRED from email mode links from email', () => {
  const s = run(email, { type: 'SUBMIT' }, { type: 'LINK_REQUIRED', message: 'verify first' });
  assert.deepEqual(s, { mode: { kind: 'link', from: 'email' }, status: 'idle', error: 'verify first' });
});

test('LINK_REQUIRED from legacy mode links from legacy', () => {
  const s = run(legacy, { type: 'SUBMIT' }, { type: 'LINK_REQUIRED', message: 'm' });
  assert.deepEqual(s.mode, { kind: 'link', from: 'legacy' });
});

test('toggle from link returns to the opposite of where it came from', () => {
  const fromEmail = run(email, { type: 'SUBMIT' }, { type: 'LINK_REQUIRED', message: 'm' });
  const fromLegacy = run(legacy, { type: 'SUBMIT' }, { type: 'LINK_REQUIRED', message: 'm' });
  assert.deepEqual(authReducer(fromEmail, { type: 'TOGGLE_LEGACY' }).mode, { kind: 'legacy' });
  assert.deepEqual(authReducer(fromLegacy, { type: 'TOGGLE_LEGACY' }).mode, { kind: 'email' });
  assert.equal(authReducer(fromLegacy, { type: 'TOGGLE_LEGACY' }).error, '');
});

test('toggle between email and legacy clears the error', () => {
  const withError = { ...email, error: 'bad' };
  assert.deepEqual(authReducer(withError, { type: 'TOGGLE_LEGACY' }), { mode: { kind: 'legacy' }, status: 'idle', error: '' });
  assert.deepEqual(authReducer(legacy, { type: 'TOGGLE_LEGACY' }).mode, { kind: 'email' });
});

test('TOGGLE_LEGACY while submitting is ignored', () => {
  const submitting = authReducer(email, { type: 'SUBMIT' });
  assert.equal(authReducer(submitting, { type: 'TOGGLE_LEGACY' }), submitting);
});

test('DONE marks the flow done and blocks further submits', () => {
  const done = run(email, { type: 'SUBMIT' }, { type: 'DONE' });
  assert.equal(done.status, 'done');
  assert.equal(authReducer(done, { type: 'SUBMIT' }), done);
});

test('isLegacy covers every mode shape', () => {
  assert.equal(isLegacy(email), false);
  assert.equal(isLegacy(legacy), true);
  assert.equal(isLegacy({ ...email, mode: { kind: 'link', from: 'legacy' } }), true);
  assert.equal(isLegacy({ ...email, mode: { kind: 'link', from: 'email' } }), false);
});
