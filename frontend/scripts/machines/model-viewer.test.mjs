import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/model-viewer.ts');
const stats = { polyCount: 120, vertices: 60 };

test('modelExtension ignores query strings, hashes and case', () => {
  assert.equal(m.modelExtension('/m/a.STL?sig=1'), 'stl');
  assert.equal(m.modelExtension('https://x.test/p/model.glb#v'), 'glb');
  assert.equal(m.modelExtension('https://x.test/media/p/model.GLTF?x=a.b'), 'gltf');
  assert.equal(m.modelExtension('/m/noext'), '');
  assert.equal(m.modelExtension('/a.b/c'), '');
  assert.equal(m.modelExtension(''), '');
});

test('supported extensions', () => {
  assert.deepEqual([...m.SUPPORTED_MODEL_EXTENSIONS], ['stl', 'obj', 'glb', 'gltf']);
});

test('starts loading', () => {
  assert.deepEqual(m.initialViewerState, { status: 'loading' });
});

test('loading -> ready with stats', () => {
  assert.deepEqual(m.viewerReducer(m.initialViewerState, { type: 'LOADED', stats }), { status: 'ready', stats });
});

test('loading -> error with the reason', () => {
  assert.deepEqual(m.viewerReducer(m.initialViewerState, { type: 'FAILED', reason: 'unsupported' }), { status: 'error', reason: 'unsupported' });
  assert.deepEqual(m.viewerReducer(m.initialViewerState, { type: 'FAILED', reason: 'failed' }), { status: 'error', reason: 'failed' });
});

test('late LOADED or FAILED after an outcome are ignored (same object)', () => {
  const error = m.viewerReducer(m.initialViewerState, { type: 'FAILED', reason: 'failed' });
  assert.equal(m.viewerReducer(error, { type: 'LOADED', stats }), error);
  const ready = m.viewerReducer(m.initialViewerState, { type: 'LOADED', stats });
  assert.equal(m.viewerReducer(ready, { type: 'FAILED', reason: 'failed' }), ready);
});

test('LOAD (new URL) resets ready and error to loading, and is a no-op while loading', () => {
  const ready = m.viewerReducer(m.initialViewerState, { type: 'LOADED', stats });
  const error = m.viewerReducer(m.initialViewerState, { type: 'FAILED', reason: 'failed' });
  assert.deepEqual(m.viewerReducer(ready, { type: 'LOAD' }), { status: 'loading' });
  assert.deepEqual(m.viewerReducer(error, { type: 'LOAD' }), { status: 'loading' });
  assert.equal(m.viewerReducer(m.initialViewerState, { type: 'LOAD' }), m.initialViewerState);
});
