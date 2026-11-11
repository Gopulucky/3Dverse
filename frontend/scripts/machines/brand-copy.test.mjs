import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { BRAND } = await loadTs('src/lib/brand.ts');

test('storefront tagline speaks to buyers', () => {
  assert.equal(BRAND.tagline, 'Finished prints, delivered. Digital models, ready to print.');
});

test('the creator pitch lives in sellerTagline', () => {
  assert.equal(BRAND.sellerTagline, 'Upload Once. Sell Forever. Print Anywhere.');
});
