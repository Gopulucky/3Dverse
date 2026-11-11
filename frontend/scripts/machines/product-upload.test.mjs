import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/product-upload.ts');
const run = (...events) => events.reduce(m.uploadReducer, m.initialUploadState);

test('starts idle', () => {
  assert.deepEqual(m.initialUploadState, { status: 'idle' });
});

test('START -> creating', () => {
  assert.deepEqual(run({ type: 'START' }), { status: 'creating' });
});

test('CREATED with a file -> uploading at 0%', () => {
  assert.deepEqual(run({ type: 'START' }, { type: 'CREATED', hasFile: true, productId: 7 }), { status: 'uploading', productId: 7, progress: 0 });
});

test('CREATED without a file -> ready with the product id', () => {
  assert.deepEqual(run({ type: 'START' }, { type: 'CREATED', hasFile: false, productId: 7 }), { status: 'ready', productId: 7 });
});

test('PROGRESS updates the percentage, and 100 moves to verifying', () => {
  const uploading = run({ type: 'START' }, { type: 'CREATED', hasFile: true, productId: 7 });
  assert.deepEqual(m.uploadReducer(uploading, { type: 'PROGRESS', percent: 40 }), { status: 'uploading', productId: 7, progress: 40 });
  const verifying = m.uploadReducer(uploading, { type: 'PROGRESS', percent: 100 });
  assert.deepEqual(verifying, { status: 'verifying', productId: 7 });
  assert.equal(m.uploadReducer(verifying, { type: 'PROGRESS', percent: 100 }), verifying);
});

test('UPLOADED -> ready from uploading or verifying, keeping the product id', () => {
  const uploading = run({ type: 'START' }, { type: 'CREATED', hasFile: true, productId: 7 });
  assert.deepEqual(m.uploadReducer(uploading, { type: 'UPLOADED' }), { status: 'ready', productId: 7 });
  const verifying = m.uploadReducer(uploading, { type: 'PROGRESS', percent: 100 });
  assert.deepEqual(m.uploadReducer(verifying, { type: 'UPLOADED' }), { status: 'ready', productId: 7 });
});

test('FAILED returns to idle from every busy state', () => {
  const creating = run({ type: 'START' });
  const uploading = m.uploadReducer(creating, { type: 'CREATED', hasFile: true, productId: 7 });
  const verifying = m.uploadReducer(uploading, { type: 'PROGRESS', percent: 100 });
  for (const s of [creating, uploading, verifying]) assert.deepEqual(m.uploadReducer(s, { type: 'FAILED' }), { status: 'idle' });
});

test('ignores events that do not apply (same object)', () => {
  const creating = run({ type: 'START' });
  assert.equal(m.uploadReducer(creating, { type: 'START' }), creating);
  assert.equal(m.uploadReducer(m.initialUploadState, { type: 'PROGRESS', percent: 50 }), m.initialUploadState);
  assert.equal(m.uploadReducer(m.initialUploadState, { type: 'FAILED' }), m.initialUploadState);
  assert.equal(m.uploadReducer(m.initialUploadState, { type: 'UPLOADED' }), m.initialUploadState);
  const ready = run({ type: 'START' }, { type: 'CREATED', hasFile: false, productId: 1 });
  assert.equal(m.uploadReducer(ready, { type: 'FAILED' }), ready);
  assert.equal(m.uploadReducer(creating, { type: 'UPLOADED' }), creating);
});

test('uploadProgress and labels', () => {
  const creating = run({ type: 'START' });
  const uploading = m.uploadReducer(creating, { type: 'CREATED', hasFile: true, productId: 7 });
  assert.equal(m.uploadProgress(m.initialUploadState), 0);
  assert.equal(m.uploadProgress(creating), 0);
  assert.equal(m.uploadProgress(m.uploadReducer(uploading, { type: 'PROGRESS', percent: 63 })), 63);
  assert.equal(m.uploadProgress(m.uploadReducer(uploading, { type: 'PROGRESS', percent: 100 })), 100);
  assert.equal(m.uploadProgress(m.uploadReducer(uploading, { type: 'UPLOADED' })), 100);
  assert.deepEqual({ ...m.UPLOAD_LABEL }, {
    creating: 'Creating listing…', uploading: 'Uploading...', verifying: 'Saving on server...', ready: 'Ready',
  });
});
