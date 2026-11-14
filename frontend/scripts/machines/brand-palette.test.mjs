// Brand palette: Deep teal (trust, 30%), Tangerine (action, 10%),
// cool white + ink neutrals (60%). Token names stay violet / ember / slate so
// call sites do not change; only their values do. These tests pin the
// anchors and the WCAG AA pairs the UI actually renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
const LA = scale(lightCss, 'amber');
const D = { violet: scale(darkBlocks, 'violet'), ember: scale(darkBlocks, 'ember'), slate: scale(darkBlocks, 'slate') };
const DA = scale(darkBlocks, 'amber');

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

test('anchors are Deep teal, Tangerine and cool white/ink', () => {
  assert.equal(L.violet[9], '#0E5E6F');
  assert.equal(L.ember[9], '#FF7A1A');
  assert.equal(L.slate[1], '#FFFFFF');
  assert.equal(L.slate[12], '#12181B');
  assert.equal(D.violet[9], '#4FC3D4');
  assert.equal(D.ember[9], '#FF8A3D');
  assert.equal(D.slate[1], '#0F1315');
  assert.equal(D.slate[12], '#E4E9EB');
});

test('brand.ts records the same anchors', () => {
  assert.equal(BRAND_COLORS.violet.hex, '#0E5E6F');
  assert.equal(BRAND_COLORS.ember.hex, '#FF7A1A');
  assert.equal(BRAND_COLORS.slate.hex, '#12181B');
});

test('light mode text and solid fills pass WCAG AA', () => {
  const white = '#FFFFFF';
  atLeast(white, L.violet[9], 4.5, 'primary button');
  atLeast(white, L.violet[10], 4.5, 'store action');
  atLeast(L.slate[12], L.ember[9], 4.5, 'buy now button (ink on tangerine)');
  atLeast(L.slate[12], L.ember[10], 4.5, 'buy now hover (ink on tangerine)');
  atLeast(L.violet[11], L.slate[1], 4.5, 'primary ink on page');
  atLeast(L.violet[11], L.violet[3], 4.5, 'primary ink on primary surface');
  atLeast(L.ember[11], L.slate[1], 4.5, 'ember ink on page');
  atLeast(L.ember[11], L.ember[3], 4.5, 'ember ink on ember surface');
  atLeast(L.slate[12], L.slate[1], 7, 'body text');
  atLeast(L.slate[11], L.slate[1], 4.5, 'muted text');
  atLeast(L.slate[11], L.slate[3], 4.5, 'muted text on muted surface');
  atLeast(L.violet[9], L.slate[1], 3, 'focus ring / accent');
  atLeast(L.slate[8], white, 3, 'input border on card (1.4.11)');
  atLeast(L.slate[8], L.slate[1], 3, 'input border on page (1.4.11)');
  atLeast(L.ember[11], L.slate[1], 3, 'selected ember border (1.4.11)');
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
  atLeast(D.slate[8], D.slate[2], 3, 'input border on card (1.4.11)');
  atLeast(D.slate[8], D.slate[1], 3, 'input border on page (1.4.11)');
  atLeast(D.ember[9], D.slate[1], 3, 'ember border (1.4.11)');
  atLeast(D.slate[12], D.violet[8], 4.5, 'printed tile text on deep teal');
});

test('dark store action ink matches the dark page background', () => {
  assert.match(darkCss, new RegExp(`--store-action-ink:\\s*${D.slate[1]}`, 'i'));
});

test('solid ember fills declare an ink foreground in both modes', () => {
  assert.match(lightCss, /--color-ember-foreground:\s*var\(--on-solid-ember\)/);
  assert.match(lightCss, /:root\s*\{[^}]*--on-solid-ember:\s*var\(--color-slate-12\)/);
  assert.match(lightCss, /\.dark\s*\{[^}]*--on-solid-ember:\s*var\(--color-slate-1\)/);
});

// Tangerine and warning amber are fill colours (<3:1 on white). Text and
// solid selected borders use the -ink step; translucent tints stay decorative.
test('no bare text-ember/text-warning or solid border-ember in src', () => {
  const root = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(name)) {
        readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (/text-(ember|warning)(?![-\w])|border-ember(?![-\w/])/.test(line)) hits.push(`${full}:${i + 1}`);
        });
      }
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});

// Portals share the storefront palette: moss is success status only, and
// decorative page/KPI icons are teal, never tangerine ink.
test('portals use no moss identity and no tangerine-ink icons', () => {
  const src = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  for (const d of ['app/creator', 'app/partner', 'app/admin', 'components/partner', 'components/creator']) walk(join(src, d));
  files.push(join(src, 'components/layout/sidebar.tsx'), join(src, 'components/shared/stat-card.tsx'));
  const hits = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/moss/.test(line) || /<[A-Z]\w*[^>]*className="[^"]*text-ember-ink/.test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});

const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

test('warning amber stays visibly apart from the Tangerine accent', () => {
  for (const [label, amber, ember] of [['light', LA, L.ember], ['dark', DA, D.ember]]) {
    for (const step of [9, 11]) {
      const gap = Math.abs(hue(amber[step]) - hue(ember[step]));
      assert.ok(gap >= 15, `${label} step ${step}: ${amber[step]} vs ${ember[step]} hue gap ${gap.toFixed(1)}`);
    }
  }
});

test('warning ink passes AA on page and warning surface', () => {
  atLeast(LA[11], L.slate[1], 4.5, 'light warning ink on page');
  atLeast(LA[11], LA[3], 4.5, 'light warning ink on surface');
  atLeast(DA[11], D.slate[1], 4.5, 'dark warning ink on page');
  atLeast(DA[11], DA[3], 4.5, 'dark warning ink on surface');
});

test('dark printed tile uses the deep teal step, not the bright button fill', () => {
  const storefront = readFileSync(new URL('../../src/styles/marketplace/storefront.css', import.meta.url), 'utf8');
  assert.match(storefront, /\.dark \.home-tile--printed\s*\{\s*background:\s*var\(--color-violet-8\);\s*color:\s*var\(--color-slate-12\)/);
});

// Warm (beige) neutrals clashed with the cool teal and cool product photos.
test('light neutrals lean cool, never warm', () => {
  for (let step = 2; step <= 12; step++) {
    const hex = L.slate[step];
    const [r, , b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(b >= r, `slate-${step} ${hex} is warm (red ${r} > blue ${b})`);
  }
});

// The blue-grey fill (#F6F8F9 / #EEF2F4) read as a stray tint behind cards,
// image wells, tabs and badges. Light fills and hairlines are now hue-less.
test('light fill and hairline neutrals carry no blue tint', () => {
  for (let step = 2; step <= 7; step++) {
    const hex = L.slate[step];
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(r === g && g === b, `slate-${step} ${hex} has a colour cast`);
  }
});

test('the Digital models tile is a white card, not a tinted fill', () => {
  const storefront = readFileSync(new URL('../../src/styles/marketplace/storefront.css', import.meta.url), 'utf8');
  const rule = storefront.match(/\.home-tile--digital\s*\{([^}]*)\}/)[1];
  assert.match(rule, /background:\s*var\(--color-card\)/);
});

test('Featured badge carries the Tangerine accent with ink text', () => {
  const storefront = readFileSync(new URL('../../src/styles/marketplace/storefront.css', import.meta.url), 'utf8');
  const rule = storefront.match(/\.market-product-featured\s*\{([^}]*)\}/)[1];
  assert.match(rule, /background:\s*var\(--color-ember\)/);
  assert.match(rule, /color:\s*var\(--color-ember-foreground\)/);
});
