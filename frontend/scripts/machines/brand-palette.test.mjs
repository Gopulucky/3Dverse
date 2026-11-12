// Brand palette: Neel indigo (trust, 30%), Terracotta (action, 10%),
// Chalk + ink neutrals (60%). Token names stay violet / ember / slate so
// call sites do not change; only their values do. These tests pin the
// anchors and the WCAG AA pairs the UI actually renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const { BRAND_COLORS } = await loadTs('src/lib/brand.ts');

const lightCss = readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8');
const darkCss = readFileSync(new URL('../../src/styles/marketplace/tokens.css', import.meta.url), 'utf8');

function scale(css, hue) {
  const out = {};
  for (const m of css.matchAll(new RegExp(`--color-${hue}-(\\d+):\\s*(#[0-9A-Fa-f]{6})`, 'g'))) {
    out[Number(m[1])] = m[2].toUpperCase();
  }
  return out;
}
// Dark values live inside `.dark { ... }` blocks in tokens.css.
const darkBlocks = [...darkCss.matchAll(/\.dark\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
const L = { violet: scale(lightCss, 'violet'), ember: scale(lightCss, 'ember'), slate: scale(lightCss, 'slate') };
const D = { violet: scale(darkBlocks, 'violet'), ember: scale(darkBlocks, 'ember'), slate: scale(darkBlocks, 'slate') };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const atLeast = (fg, bg, min, label) =>
  assert.ok(contrast(fg, bg) >= min, `${label}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}, needs ${min}`);

test('every scale has all 12 steps in light and dark', () => {
  for (const [mode, s] of Object.entries({ L, D })) {
    for (const [hue, steps] of Object.entries(s)) {
      assert.equal(Object.keys(steps).length, 12, `${mode} ${hue}`);
    }
  }
});

test('anchors are Neel indigo, Terracotta and Chalk/ink', () => {
  assert.equal(L.violet[9], '#2E3A87');
  assert.equal(L.ember[9], '#B4441C');
  assert.equal(L.slate[1], '#FBFAF7');
  assert.equal(L.slate[12], '#1F2430');
  assert.equal(D.violet[9], '#8C9BFF');
  assert.equal(D.ember[9], '#F0875A');
  assert.equal(D.slate[1], '#111318');
  assert.equal(D.slate[12], '#E6E8EE');
});

test('brand.ts records the same anchors', () => {
  assert.equal(BRAND_COLORS.violet.hex, '#2E3A87');
  assert.equal(BRAND_COLORS.ember.hex, '#B4441C');
  assert.equal(BRAND_COLORS.slate.hex, '#1F2430');
});

test('light mode text and solid fills pass WCAG AA', () => {
  const white = '#FFFFFF';
  atLeast(white, L.violet[9], 4.5, 'primary button');
  atLeast(white, L.violet[10], 4.5, 'store action');
  atLeast(white, L.ember[9], 4.5, 'buy now button');
  atLeast(L.violet[11], L.slate[1], 4.5, 'primary ink on page');
  atLeast(L.violet[11], L.violet[3], 4.5, 'primary ink on primary surface');
  atLeast(L.ember[11], L.slate[1], 4.5, 'ember ink on page');
  atLeast(L.ember[11], L.ember[3], 4.5, 'ember ink on ember surface');
  atLeast(L.slate[12], L.slate[1], 7, 'body text');
  atLeast(L.slate[11], L.slate[1], 4.5, 'muted text');
  atLeast(L.slate[11], L.slate[3], 4.5, 'muted text on muted surface');
  atLeast(L.violet[9], L.slate[1], 3, 'focus ring / accent');
});

test('dark mode text and solid fills pass WCAG AA', () => {
  const ink = D.slate[1]; // --on-solid-primary and --store-action-ink
  atLeast(ink, D.violet[9], 4.5, 'primary button');
  atLeast(ink, D.ember[9], 4.5, 'buy now button');
  atLeast(D.violet[11], D.slate[1], 4.5, 'primary ink on page');
  atLeast(D.violet[11], D.violet[3], 4.5, 'primary ink on primary surface');
  atLeast(D.ember[11], D.slate[1], 4.5, 'ember ink on page');
  atLeast(D.ember[11], D.ember[3], 4.5, 'ember ink on ember surface');
  atLeast(D.slate[12], D.slate[1], 7, 'body text');
  atLeast(D.slate[11], D.slate[1], 4.5, 'muted text');
  atLeast(D.slate[11], D.slate[3], 4.5, 'muted text on muted surface');
  atLeast(D.violet[9], D.slate[1], 3, 'focus ring / accent');
});

test('dark store action ink matches the dark page background', () => {
  assert.match(darkCss, new RegExp(`--store-action-ink:\\s*${D.slate[1]}`, 'i'));
});
