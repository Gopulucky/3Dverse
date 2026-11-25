// Brand name: the product is "buy&sell3d" (all lowercase, ampersand). The wordmark is
// built from two styled halves, so the halves must always join back into the name, and
// the old name must not survive anywhere users can see it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadTs } from '../load-ts.mjs';

const { BRAND, LOGO_RULES } = await loadTs('src/lib/brand.ts');

test('the brand name is buy&sell3d', () => {
  assert.equal(BRAND.name, 'buy&sell3d');
});

// The logo is the name alone: no symbol. Only the & is coloured (Tangerine); the rest is
// ink, so the name stays fully legible without relying on the accent colour.
test('the wordmark parts join back into the brand name and only the & is accented', () => {
  const { before, accent, after } = BRAND.wordmark;
  assert.equal(before + accent + after, BRAND.name);
  assert.equal(accent, '&');
});

test('the logo rules state the new spelling', () => {
  assert.match(LOGO_RULES[0], /buy&sell3d/);
  assert.doesNotMatch(LOGO_RULES.join('\n'), /Verse/i);
});

// Two deliberate exceptions:
//  - the site URL fallback keeps the old domain until the real domain is chosen; it is only
//    used when NEXT_PUBLIC_SITE_URL is unset;
//  - `sell_on_3dverse` is a legacy value that may already sit in users' browser storage,
//    so it must keep mapping to "seller".
const PENDING_DOMAIN = /NEXT_PUBLIC_SITE_URL \?\? "https:\/\/3dverse\.com"|^\s*sell_on_3dverse: "seller",$/;

test('no shipped frontend source still uses the old name', () => {
  const root = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|css|json|mjs)$/.test(name)) {
        readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (/3d\s?-?verse/i.test(line) && !PENDING_DOMAIN.test(line)) hits.push(`${full}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});

// The name is always lowercase. A parent that sets `uppercase` (the About page's CTA label
// does) must not turn the logo into BUY&SELL3D.
test('the wordmark resets inherited text-transform to lowercase', () => {
  const src = readFileSync(new URL('../../src/components/shared/wordmark.tsx', import.meta.url), 'utf8');
  assert.match(src, /normal-case/);
});

test('no hand-built wordmark still spells the old halves', () => {
  const root = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(name) && /text-gradient-primary">3d</.test(readFileSync(full, 'utf8'))) hits.push(full);
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});
