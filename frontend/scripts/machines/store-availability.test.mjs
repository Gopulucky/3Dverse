import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { storeAvailability, trustItems, printedTile } = await loadTs('src/lib/store-availability.ts');
const keys = (items) => items.map((item) => item.key);

test('missing or malformed availability promises nothing', () => {
  for (const value of [undefined, null, {}, { checkout: 'yes', printed: 1 }]) {
    assert.deepEqual(storeAvailability(value), { checkout: false, printed: false });
  }
});

test('nothing working: only the download rule is shown', () => {
  assert.deepEqual(keys(trustItems({ checkout: false, printed: false })), ['downloads']);
});

test('payment works but no prints: no delivery claim', () => {
  assert.deepEqual(keys(trustItems({ checkout: true, printed: false })), ['downloads', 'payment']);
});

test('everything works: delivery, downloads and payment', () => {
  assert.deepEqual(keys(trustItems({ checkout: true, printed: true })), ['delivery', 'downloads', 'payment']);
});

test('printed tile says coming soon until prints can be bought', () => {
  assert.equal(printedTile({ checkout: true, printed: false }).caption, 'Coming soon');
  assert.equal(printedTile({ checkout: true, printed: false }).comingSoon, true);
  assert.equal(printedTile({ checkout: true, printed: true }).caption, 'Delivered in India');
  assert.equal(printedTile({ checkout: true, printed: true }).comingSoon, false);
});

test('the hero sentence promises delivery only when printed orders work', async () => {
  const { heroSentence } = await loadTs('src/lib/store-availability.ts');
  assert.equal(heroSentence({ checkout: true, printed: true }),
    'Finished 3D prints delivered in India, and digital models ready for your own printer.');
  assert.equal(heroSentence({ checkout: true, printed: false }),
    'Digital models ready for your own printer. Finished prints are coming soon.');
});
