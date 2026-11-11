import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/machines/search-suggestions.ts');
const run = (state, ...events) => events.reduce(m.searchReducer, state);
const items = [
  { type: 'category', label: 'Gadgets' },
  { type: 'product', label: 'Vase', sub: 'Home Decor', price: 10, id: 3 },
];

test('starts closed and empty', () => {
  assert.deepEqual(m.initialSearchState, { status: 'closed', query: '', items: [], activeIdx: -1 });
});

test('queries shorter than 2 characters stay closed and drop old results', () => {
  const open = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items });
  assert.equal(open.status, 'open');
  const short = m.searchReducer(open, { type: 'INPUT', query: 'v' });
  assert.deepEqual(short, { status: 'closed', query: 'v', items: [], activeIdx: -1 });
  assert.equal(m.searchReducer(m.initialSearchState, { type: 'INPUT', query: ' a ' }).status, 'closed');
});

test('a 2+ character query from closed starts debouncing', () => {
  const s = m.searchReducer(m.initialSearchState, { type: 'INPUT', query: 'va' });
  assert.equal(s.status, 'debouncing');
  assert.equal(s.query, 'va');
});

test('matching RESULTS open the list with nothing highlighted', () => {
  const s = run(m.initialSearchState, { type: 'INPUT', query: ' va ' }, { type: 'RESULTS', query: 'va', items });
  assert.deepEqual(s, { status: 'open', query: 'va', items, activeIdx: -1 });
});

test('ignores stale results (cleared, closed or changed before the response)', () => {
  const cleared = run(m.initialSearchState, { type: 'INPUT', query: 'ab' }, { type: 'INPUT', query: '' });
  assert.equal(m.searchReducer(cleared, { type: 'RESULTS', query: 'ab', items }), cleared);
  const closed = run(m.initialSearchState, { type: 'INPUT', query: 'ab' }, { type: 'CLOSE' });
  assert.equal(m.searchReducer(closed, { type: 'RESULTS', query: 'ab', items }), closed);
  const changed = m.searchReducer(m.initialSearchState, { type: 'INPUT', query: 'abc' });
  assert.equal(m.searchReducer(changed, { type: 'RESULTS', query: 'ab', items }), changed);
});

test('empty RESULTS close the list', () => {
  const s = run(m.initialSearchState, { type: 'INPUT', query: 'zz' }, { type: 'RESULTS', query: 'zz', items: [] });
  assert.equal(s.status, 'closed');
});

test('typing while open keeps the old results visible until new ones arrive', () => {
  const open = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items });
  const typing = m.searchReducer(open, { type: 'INPUT', query: 'vas' });
  assert.equal(typing.status, 'open');
  assert.equal(typing.query, 'vas');
  assert.deepEqual(typing.items, items);
  assert.equal(typing.activeIdx, -1);
});

test('ARROW moves within [-1, last] and only while open', () => {
  const open = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items });
  assert.equal(m.searchReducer(open, { type: 'ARROW', dir: -1 }), open);
  const one = m.searchReducer(open, { type: 'ARROW', dir: 1 });
  const two = m.searchReducer(one, { type: 'ARROW', dir: 1 });
  const clamped = m.searchReducer(two, { type: 'ARROW', dir: 1 });
  assert.deepEqual([one.activeIdx, two.activeIdx, clamped.activeIdx], [0, 1, 1]);
  assert.equal(m.searchReducer(m.initialSearchState, { type: 'ARROW', dir: 1 }), m.initialSearchState);
});

test('activeSuggestion returns the highlighted item or null', () => {
  const open = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items });
  assert.equal(m.activeSuggestion(open), null);
  assert.deepEqual(m.activeSuggestion(m.searchReducer(open, { type: 'ARROW', dir: 1 })), items[0]);
});

test('CLOSE keeps the query and last results, and is a no-op when already closed', () => {
  const open = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items }, { type: 'ARROW', dir: 1 });
  const closed = m.searchReducer(open, { type: 'CLOSE' });
  assert.deepEqual(closed, { status: 'closed', query: 'va', items, activeIdx: -1 });
  assert.equal(m.searchReducer(closed, { type: 'CLOSE' }), closed);
});

test('FOCUS reopens cached results for a long-enough query only', () => {
  const closed = run(m.initialSearchState, { type: 'INPUT', query: 'va' }, { type: 'RESULTS', query: 'va', items }, { type: 'CLOSE' });
  assert.equal(m.searchReducer(closed, { type: 'FOCUS' }).status, 'open');
  assert.equal(m.searchReducer(m.initialSearchState, { type: 'FOCUS' }), m.initialSearchState);
});

test('toSuggestions lists categories first, then products, and the helpers narrow them', () => {
  const list = m.toSuggestions({
    products: [{ id: 3, title: 'Vase', category: 'Home Decor', price: 10 }],
    categories: ['Gadgets', 'Gaming'],
  });
  assert.deepEqual(list.map((s) => s.label), ['Gadgets', 'Gaming', 'Vase']);
  assert.equal(list[2].sub, 'Home Decor');
  assert.equal(m.categoryItems(list).length, 2);
  assert.equal(m.productItems(list).length, 1);
});
