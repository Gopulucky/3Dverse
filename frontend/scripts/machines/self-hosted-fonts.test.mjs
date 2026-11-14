// Brand fonts are self-hosted. next/font/google fetches CSS from Google at
// build time, and CI once received font URLs with extra query parameters
// that Turbopack rejects ("next/font/google queries have exactly one entry").
// Local files make the build hermetic. Regenerate with scripts/fonts/build_fonts.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const appDir = new URL('../../src/app/', import.meta.url);
const layout = readFileSync(new URL('layout.tsx', appDir), 'utf8');
const srcRoot = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('no source file loads fonts from next/font/google', () => {
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|mjs|css)$/.test(name) && readFileSync(full, 'utf8').includes('next/font/google')) hits.push(full);
    }
  };
  walk(srcRoot);
  assert.deepEqual(hits, []);
});

test('layout loads the three brand families with next/font/local', () => {
  assert.match(layout, /from "next\/font\/local"/);
  for (const v of ['--font-space-grotesk', '--font-ibm-plex-sans', '--font-ibm-plex-mono']) {
    assert.match(layout, new RegExp(`variable: "${v}"`), v);
  }
});

test('every font file the layout references exists and is woff2', () => {
  const paths = [...layout.matchAll(/path: "(\.\/fonts\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(paths.length >= 3, `expected font paths in layout, found ${paths.length}`);
  for (const p of paths) {
    const file = new URL(p, appDir);
    assert.ok(existsSync(file), `missing ${p}`);
    assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', `${p} is not woff2`);
  }
});

test('the Open Font License ships with each family', () => {
  for (const f of ['OFL-SpaceGrotesk.txt', 'OFL-IBMPlex.txt']) {
    assert.ok(existsSync(new URL(`fonts/${f}`, appDir)), f);
  }
});
