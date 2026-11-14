import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const b = await loadTs('src/lib/buy-now.ts');
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};
const item = { product_id: 12, quantity: 1, purchase_type: 'physical', selected_config: { material: 'PLA', color: 'Red' } };

test('the key is per customer', () => {
  assert.notEqual(b.buyNowKey(1), b.buyNowKey(2));
  assert.equal(b.buyNowKey(undefined), b.buyNowKey(undefined));
});

test('a saved item reads back exactly', () => {
  const store = memory();
  b.saveBuyNow(store, 7, item);
  assert.deepEqual(b.readBuyNow(store, 7), item);
  assert.equal(b.readBuyNow(store, 8), null);
});

test('missing, broken or tampered values read as nothing', () => {
  const store = memory();
  assert.equal(b.readBuyNow(store, 7), null);
  store.setItem(b.buyNowKey(7), '{not json');
  assert.equal(b.readBuyNow(store, 7), null);
  for (const bad of [
    { ...item, product_id: 'x' }, { ...item, product_id: 0 }, { ...item, quantity: 2 },
    { ...item, purchase_type: 'download' }, { ...item, selected_config: 'red' }, { ...item, selected_config: { size: 3 } }, null, [],
  ]) {
    store.setItem(b.buyNowKey(7), JSON.stringify(bad));
    assert.equal(b.readBuyNow(store, 7), null, JSON.stringify(bad));
  }
});

test('storage that throws never breaks the page', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(b.readBuyNow(broken, 7), null);
  assert.doesNotThrow(() => b.saveBuyNow(broken, 7, item));
});

test('the request body carries only the one item', () => {
  assert.deepEqual(b.directItemBody(item), item);
  assert.equal(b.directItemBody(null), undefined);
});
