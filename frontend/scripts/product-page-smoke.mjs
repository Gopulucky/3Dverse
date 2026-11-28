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
  id: 9100, title: 'QA dice tower', description, category: 'Tabletop', creator_id: 7, creator_name: 'gopuhardik',
  print_settings: { recommended_materials: ['PLA', 'PETG'], layer_height: '0.2mm', supports: 'none' },
  price: 199, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true, license_type: 'Personal Use',
  versions: [{ preview_url: 'http://fixture.test/m.stl', is_latest: true, file_format: 'STL', file_size: 2048,
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
    if (url.pathname.endsWith('/api/creators/7')) return send({ id: 7, name: 'gopuhardik', product_count: 13, follower_count: 0 });
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
  assert.match(await price.innerText(), /₹199(?![d.])/);
  assert.match(await price.innerText(), /Licence: Personal Use/);
  // What the buyer gets, once each, before paying.
  const included = await page.getByRole('region', { name: "What's included" }).innerText();
  for (const fact of ['STL, 2 KB', '80 × 120 × 160 mm', '357.3 cm³', 'Passed', 'Personal Use', 'Download after payment']) assert.ok(included.includes(fact), fact);
  const printing = await page.getByRole('region', { name: 'Printing it' }).innerText();
  for (const fact of ['PLA, PETG', '0.2 mm', 'Not required']) assert.ok(printing.includes(fact), fact);
  assert.equal((await page.locator('main').innerText()).split('80 × 120 × 160 mm').length - 1, 1, 'the size is stated once');
  // One clear purchase order, no repeated seller line, nothing about shipping a file.
  const buttons = await page.locator('[data-flow="buy-box"] button').allInnerTexts();
  assert.deepEqual(buttons.map((t) => t.trim()).filter((t) => /^(Buy now|Add to cart)$/.test(t)), ['Buy now', 'Add to cart']);
  assert.equal(await page.getByText('Sold by', { exact: false }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Shipping', exact: true }).locator('visible=true').count(), 1, 'only the footer links shipping');
  await page.getByRole('button', { name: 'Save to wishlist', exact: true }).waitFor();
  assert.equal(await page.getByText('0 ratings').count(), 0);
  const maker = page.getByRole('region', { name: 'Creator' });
  await maker.getByText('13 designs').waitFor();
  assert.equal(await maker.getByRole('link', { name: 'View profile' }).getAttribute('href'), '/creators/7');
  assert.equal(await page.getByRole('button', { name: /^Follow/ }).count(), 1);
  // No reviews yet: say so, and keep the form out of the way.
  const reviews = page.getByRole('region', { name: 'Reviews' });
  await reviews.getByText('No reviews yet.').waitFor();
  assert.equal(await reviews.getByRole('textbox').count(), 0);
  assert.equal(await reviews.getByRole('link', { name: 'Sign in to write a review' }).count(), 1);
  assert.equal(await page.getByRole('region', { name: 'Similar designs' }).count(), 0, 'no filler recommendations');
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
  // Only zoom, fullscreen and settings are always on show.
  assert.equal(await viewer.getByRole('button', { name: 'Wireframe' }).count(), 0);
  assert.equal(await viewer.getByText('Polys', { exact: false }).count(), 0);
  await viewer.getByRole('button', { name: 'Fullscreen' }).waitFor();
  // The toolbar is inside the picture frame, not cut off below it.
  const clipped = await viewer.getByRole('button', { name: 'Viewer settings' }).evaluate(button => {
    const frame = button.closest('[data-flow="model-viewer"]').parentElement.closest('.overflow-hidden').getBoundingClientRect();
    return button.getBoundingClientRect().bottom - frame.bottom;
  });
  assert.ok(clipped <= 0, `viewer toolbar is cut off by ${clipped}px`);
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await viewer.getByRole('button', { name: 'Viewer settings' }).click();
  await viewer.getByRole('button', { name: 'Wireframe' }).waitFor();
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
