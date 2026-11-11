import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { homeSections, PRIMARY_LIMIT, SECOND_LIMIT } = await loadTs('src/lib/home-sections.ts');
const p = (id) => ({ id, title: `P${id}` });
const ids = (list) => list.map((x) => x.id);

test('new arrivals lead the page, capped at six', () => {
  const s = homeSections({ new_arrivals: [1, 2, 3, 4, 5, 6, 7, 8].map(p), featured: [], trending: [] });
  assert.equal(s.primary.title, 'New arrivals');
  assert.deepEqual(ids(s.primary.products), [1, 2, 3, 4, 5, 6]);
  assert.equal(PRIMARY_LIMIT, 6);
});

test('a product shown in the first row never repeats in the second', () => {
  const s = homeSections({ new_arrivals: [1, 2].map(p), featured: [2, 3].map(p), trending: [1, 3, 4].map(p) });
  assert.deepEqual(ids(s.primary.products), [1, 2]);
  assert.deepEqual(ids(s.second.products), [3, 4]);
  assert.equal(s.second.title, 'Trending');
});

test('the second row hides itself when nothing new is left to show', () => {
  const s = homeSections({ new_arrivals: [1].map(p), featured: [1].map(p), trending: [1].map(p) });
  assert.deepEqual(ids(s.second.products), []);
});

test('with no new arrivals the first row falls back to featured, then trending', () => {
  const featured = homeSections({ new_arrivals: [], featured: [5, 6].map(p), trending: [7].map(p) });
  assert.equal(featured.primary.title, 'Featured');
  assert.deepEqual(ids(featured.primary.products), [5, 6]);
  assert.deepEqual(ids(featured.second.products), [7]);
  const trending = homeSections({ new_arrivals: [], featured: [], trending: [7, 8].map(p) });
  assert.equal(trending.primary.title, 'Trending');
  assert.deepEqual(ids(trending.primary.products), [7, 8]);
  assert.deepEqual(ids(trending.second.products), []);
});

test('duplicates inside one list are removed and the second row is capped', () => {
  const many = Array.from({ length: 30 }, (_, i) => p(i + 100));
  const s = homeSections({ new_arrivals: [1, 1, 2].map(p), featured: [], trending: many });
  assert.deepEqual(ids(s.primary.products), [1, 2]);
  assert.equal(s.second.products.length, SECOND_LIMIT);
  assert.equal(SECOND_LIMIT, 12);
});

test('missing lists are treated as empty', () => {
  const s = homeSections({});
  assert.equal(s.empty, true);
  assert.deepEqual(s.primary.products, []);
  assert.equal(homeSections({ new_arrivals: [p(1)] }).empty, false);
});
