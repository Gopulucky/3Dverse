import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const r = await loadTs('src/lib/region.ts');

test('India is the default and the first choice', () => {
  assert.equal(r.DEFAULT_COUNTRY, 'IN');
  assert.equal(r.COUNTRIES[0].code, 'IN');
  assert.equal(new Set(r.COUNTRIES.map((c) => c.code)).size, r.COUNTRIES.length, 'country codes are unique');
});

test('every country has a currency we know a rate for', () => {
  for (const country of r.COUNTRIES) {
    assert.ok(country.currency === 'INR' || r.INR_PER_UNIT[country.currency] > 0, `${country.code} ${country.currency}`);
  }
});

test('a country code gives its currency, in any case, and unknown places show US dollars', () => {
  assert.equal(r.currencyForCountry('AU'), 'AUD');
  assert.equal(r.currencyForCountry('us'), 'USD');
  assert.equal(r.currencyForCountry('IN'), 'INR');
  assert.equal(r.currencyForCountry('ZZ'), 'USD');
  assert.equal(r.currencyForCountry(undefined), 'INR');
  assert.equal(r.currencyForCountry(''), 'INR');
});

test('only real two-letter codes from the list are accepted when reading a stored choice', () => {
  assert.equal(r.readCountry('au'), 'AU');
  assert.equal(r.readCountry('<script>'), undefined);
  assert.equal(r.readCountry('ZZ'), undefined);
  assert.equal(r.readCountry(null), undefined);
});

test('an Indian shopper sees the plain rupee price', () => {
  assert.deepEqual(r.displayPrice(599, 'INR', 'IN'), { main: '₹599.00' });
});

test('a shopper abroad sees an approximate price in their currency and the rupee amount that is charged', () => {
  const view = r.displayPrice(570, 'INR', 'AU');
  assert.equal(view.main, `≈ A$${(570 / r.INR_PER_UNIT.AUD).toFixed(2)}`);
  assert.equal(view.charged, '₹570.00');
});

test('prices already in another currency are never converted', () => {
  assert.deepEqual(r.displayPrice(12, 'USD', 'AU'), { main: 'USD 12.00' });
  assert.deepEqual(r.displayPrice(12, 'USD', 'IN'), { main: 'USD 12.00' });
});

test('a missing product currency counts as rupees', () => {
  assert.equal(r.displayPrice(100, undefined, 'IN').main, '₹100.00');
  assert.ok(r.displayPrice(100, undefined, 'US').main.startsWith('≈ $'));
});

test('conversion rounds to two places and never goes negative or NaN', () => {
  assert.equal(r.convertFromInr(88, 'USD'), 1);
  assert.equal(r.convertFromInr(0, 'USD'), 0);
  assert.equal(r.convertFromInr(100, 'INR'), 100);
  assert.equal(r.convertFromInr(100, 'XXX'), 100, 'an unknown currency leaves the amount alone');
});
