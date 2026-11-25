/**
 * Product page checks against isolated API fixtures: layout order, the clickable
 * gallery, price-before-format, and how the 3D viewer answers a mouse.
 * Does not verify a real backend, real uploads or a real model file.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const swatch = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${fill}"/></svg>`;
const media = [
  { id: 1, media_url: 'http://fixture.test/side.svg', media_type: 'image', is_primary: false },
  { id: 2, media_url: 'http://fixture.test/front.svg', media_type: 'image', is_primary: true },
];
const stl = `solid cube
facet normal 0 0 1
outer loop
vertex 0 0 10
vertex 10 0 10
vertex 10 10 10
endloop
endfacet
facet normal 0 0 1
outer loop
vertex 0 0 10
vertex 10 10 10
vertex 0 10 10
endloop
endfacet
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 10 10 0
vertex 10 0 0
endloop
endfacet
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 0 10 0
vertex 10 10 0
endloop
endfacet
endsolid cube`;
const description = 'A square dice tower with three internal baffles, an open top and a front exit window onto a tray with a rim. Size 80 x 120 x 160 mm. Suggested material PLA or PETG at 0.2 mm layer height. Prints with no supports. Lay the baffles flat for the cleanest finish and sand the tray rim lightly.';
const product = {
  id: 9100, title: 'QA dice tower', description, category: 'Tabletop', creator_name: 'gopuhardik',
  price: 199, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true, license_type: 'Personal Use',
  versions: [{ preview_url: 'http://fixture.test/m.stl', file_name: 'tower.stl', file_size: 2048,
    printability_report: { status: 'pass', volume_mm3: 357300, dimensions: { x: 80, y: 120, z: 160 } } }],
  media,
};

async function open(reducedMotion) {
  const context = await browser.newContext({ reducedMotion, bypassCSP: true, viewport: { width: 1280, height: 800 } });
  await context.route('http://fixture.test/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('.stl')) return route.fulfill({ body: stl, contentType: 'model/stl', headers: { 'access-control-allow-origin': '*' } });
    return route.fulfill({ body: swatch(path.includes('front') ? '#0E5E6F' : '#FF7A1A'), contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const send = (json) => route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/marketplace/products/9100')) return send(product);
    return send([]);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/marketplace/9100`);
  await page.getByRole('heading', { level: 1, name: 'QA dice tower' }).waitFor();
  return { context, page, errors };
}

try {
  // --- Layout, gallery, price, format -------------------------------------------------
  const { context, page, errors } = await open('no-preference');

  const order = await page.evaluate(() => {
    const top = (selector) => document.querySelector(selector)?.getBoundingClientRect().top;
    return { title: top('h1'), gallery: top('[data-flow="product-gallery"]'), price: top('[data-flow="product-price"]') };
  });
  assert.ok(order.title < order.gallery, 'the title sits above the gallery');
  assert.ok(order.price != null, 'the price is on the page');

  const gallery = page.locator('[data-flow="product-gallery"]');
  const thumbs = gallery.getByRole('group', { name: 'Product views' }).getByRole('button');
  assert.deepEqual(await thumbs.evaluateAll((b) => b.map((x) => x.getAttribute('aria-label'))),
    ['Show 3d model', 'Show photo 1 of 2', 'Show photo 2 of 2'], 'model first, then photos, primary photo leading');
  assert.equal(await gallery.getAttribute('data-selected'), 'model');

  await gallery.getByRole('button', { name: 'Show photo 1 of 2' }).click();
  assert.equal(await gallery.getAttribute('data-selected'), 'image');
  assert.match(await gallery.locator('img[alt$="photo"]').getAttribute('src'), /front\.svg$/, 'the primary photo is the first photo');
  await gallery.getByRole('button', { name: 'Show photo 2 of 2' }).click();
  assert.match(await gallery.locator('img[alt$="photo"]').getAttribute('src'), /side\.svg$/);
  assert.equal(await gallery.getByRole('button', { name: 'Show photo 2 of 2' }).getAttribute('aria-pressed'), 'true');

  const price = page.locator('[data-flow="product-price"]');
  assert.equal(await price.getAttribute('data-state'), 'chosen', 'a single-format listing has its format chosen already');
  assert.match(await price.innerText(), /₹199\.00/);
  assert.match(await price.innerText(), /80 × 120 × 160 mm/, 'dimensions are shown beside the price');
  assert.equal(await page.getByRole('radio', { name: /Digital model file/ }).isChecked(), true);
  assert.equal(await page.getByRole('button', { name: 'Add to cart', exact: true }).isEnabled(), true);

  const more = page.getByRole('button', { name: 'Read more' });
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  await more.click();
  assert.equal(await page.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded'), 'true');
  await page.getByRole('button', { name: 'Show less' }).click();

  // The format box stays short: it must not be taller than the picture beside it.
  const box = await page.locator('fieldset').boundingBox();
  assert.ok(box.height < 140, `the format picker is compact (${Math.round(box.height)}px)`);

  // --- 3D viewer behaviour ----------------------------------------------------------
  await gallery.getByRole('button', { name: 'Show 3d model' }).click();
  const viewer = page.locator('[data-flow="model-viewer"]');
  await viewer.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-flow="model-viewer"]')?.getAttribute('data-state') === 'ready', null, { timeout: 20000 });
  // SMOKE_SHOTS=<folder> saves screenshots for a visual review; it changes nothing else.
  if (process.env.SMOKE_SHOTS) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${process.env.SMOKE_SHOTS}/product-desktop.png` });
  }
  assert.equal(await viewer.getAttribute('data-spin'), 'on', 'it turns by itself at first');
  assert.equal(await viewer.getAttribute('data-zoom'), 'locked', 'the wheel still scrolls the page');

  const bounds = await viewer.boundingBox();
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  assert.ok((await page.evaluate(() => scrollY)) > before, 'wheel over a fresh viewer scrolls the page instead of zooming');

  await page.evaluate(() => scrollTo(0, 0));
  const fresh = await viewer.boundingBox();
  await page.mouse.click(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  assert.equal(await viewer.getAttribute('data-spin'), 'off', 'it stops turning once touched');
  assert.equal(await viewer.getAttribute('data-zoom'), 'live', 'and scroll-zoom is now live');

  const atRest = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), atRest, 'the page does not scroll while the viewer zooms');

  await page.mouse.move(2, 2);
  assert.equal(await viewer.getAttribute('data-zoom'), 'locked', 'moving away gives the page its wheel back');
  assert.equal(await viewer.getAttribute('data-spin'), 'off', 'and it does not start spinning again');

  await page.mouse.move(centre.x, centre.y);
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await viewer.getByRole('button', { name: 'Reset view' }).click();
  await viewer.getByRole('button', { name: 'Spin automatically' }).click();
  assert.equal(await viewer.getAttribute('data-spin'), 'on', 'the spin toggle brings it back');
  assert.deepEqual(errors, [], 'no page errors');
  await context.close();

  // --- Reduced motion never spins -----------------------------------------------------
  const calm = await open('reduce');
  await calm.page.locator('[data-flow="model-viewer"]').waitFor();
  assert.equal(await calm.page.locator('[data-flow="model-viewer"]').getAttribute('data-spin'), 'off');
  await calm.context.close();

  // --- Phone width keeps everything on screen ---------------------------------------------
  const phone = await open('no-preference');
  await phone.page.setViewportSize({ width: 375, height: 812 });
  await phone.page.reload();
  await phone.page.getByRole('heading', { level: 1, name: 'QA dice tower' }).waitFor();
  assert.equal(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll on a phone');
  if (process.env.SMOKE_SHOTS) await phone.page.screenshot({ path: `${process.env.SMOKE_SHOTS}/product-phone.png`, fullPage: true });
  await phone.context.close();

  console.log('product-page-smoke: ok');
} finally {
  await browser.close();
}
