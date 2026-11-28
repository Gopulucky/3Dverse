import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const { CATEGORIES, orderCategories } = await loadTs('src/lib/categories.ts');

test('categories show once each, in one fixed order, with unknown names before "Other"', () => {
  assert.deepEqual(orderCategories(['Other', 'Gadgets', 'Tabletop', 'Gadgets', 'Zeta', 'Alpha', '']),
    ['Tabletop', 'Gadgets', 'Alpha', 'Zeta', 'Other']);
});

test('the search suggestions the API offers are all in the shared list', () => {
  const python = readFileSync(new URL('../../../backend/app/api/routers/marketplace.py', import.meta.url), 'utf8');
  const block = python.match(/CATEGORIES = \[([\s\S]*?)\]/)[1];
  const offered = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(offered.length >= 8);
  for (const name of offered) assert.ok(CATEGORIES.includes(name), name);
});
