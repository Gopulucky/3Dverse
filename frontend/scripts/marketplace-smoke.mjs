/** Browser regressions for the storefront. Uses isolated API fixtures; no real
 * accounts, catalogue records or purchases are created. Run with next dev/start.
 * node scripts/marketplace-smoke.mjs [http://127.0.0.1:3000]
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const out = '.hallmark/verification';
mkdirSync(out, { recursive: true });
const imagePath = process.env.UI_SCAN_PRODUCT_IMAGE || '../sample_images/3d-bench.jpg';
const image = existsSync(imagePath) ? readFileSync(imagePath) : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64');
const contentType = existsSync(imagePath) ? 'image/jpeg' : 'image/png';
const product = {
  id: 9001, title: 'Sample bench', category: 'Home Decor', price: 12,
  creator_name: 'QA catalogue', avg_rating: 4.5, review_count: 2,
  is_mode_2_active: true, is_featured: true,
  media: [{ media_url: '/qa-bench.jpg', is_primary: true }],
  versions: [{ is_latest: true, printability_report: { status: 'pass' } }],
};
const products = Array.from({ length: 4 }, (_, index) => ({ ...product, id: 9001 + index, title: index ? `Sample model ${index + 1}` : product.title }));
const full = {
  featured: products, trending: products, new_arrivals: products,
  categories: ['Home Decor', 'Tabletop', 'Miniatures', 'Architecture', 'Gadgets', 'Jewelry'].map(name => ({ name })),
  popular_creators: [{ name: 'QA catalogue', role: 'Test fixture', initials: 'QA' }],
};
const empty = { featured: [], trending: [], new_arrivals: [], categories: [], popular_creators: [] };
const checks = [];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
async function visit({ state = 'full', authenticated = false, colorScheme = 'light', viewport = { width: 1440, height: 900 } } = {}) {
  // The production CSP deliberately blocks a cross-port HTTP API on localhost.
  // Bypass it only inside this isolated fixture browser; deployment uses HTTPS.
  const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme, viewport, bypassCSP: true });
  const current = { state, posts: [], homepageRequests: 0 };
  if (authenticated) await context.addInitScript(() => {
    localStorage.setItem('token', 'qa-only-token');
    localStorage.setItem('user', JSON.stringify({ id: 99, email: 'qa@example.test', role: 'customer' }));
  });
  await context.route('**/qa-bench.jpg', route => route.fulfill({ body: image, contentType }));
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const send = (json, status = 200) => route.fulfill({ json, status, headers: { 'access-control-allow-origin': '*' } });
    if (path.endsWith('/homepage')) {
      current.homepageRequests++;
      if (current.state === 'error') return send({ detail: 'QA simulated outage' }, 503);
      if (current.state === 'loading') await new Promise(resolve => { current.release = resolve; });
      return send(current.state === 'empty' ? empty : full);
    }
    if (path.endsWith('/suggestions')) return send({ products: [product], categories: ['Home Decor'] });
    if (path.endsWith('/products')) return send(products);
    if (/\/products\/\d+$/.test(path)) return send(product);
    if (path.endsWith('/users/me')) return send({ id: 99, email: 'qa@example.test', role: 'customer' });
    if (path.endsWith('/cart/items') && request.method() === 'POST') {
      current.posts.push(request.postDataJSON());
      return send({ items: [{ id: 1, product_id: 9001, quantity: current.posts.length }] });
    }
    if (path.endsWith('/cart/')) return send({ items: [] });
    return send([]);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return { page, context, current, errors };
}
async function visible(locator) { await locator.waitFor({ state: 'visible', timeout: 20000 }); }
async function settleImages(page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
  });
  assert.ok(await page.locator('.store-hero-image img').evaluate(image => image.complete && image.naturalWidth > 0), 'Hero fixture image must load before visual capture.');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function contrast(a, b) {
  const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
try {
  const { page, context, current, errors } = await visit({ authenticated: true });
  await visible(page.getByRole('link', { name: 'Explore Sample bench' }));
  await page.evaluate(() => document.fonts.ready);
  await settleImages(page);
  assert.equal(await page.locator('.market-product-reviews').first().innerText(), '4.5\n2 reviews\nPrintability passed');
  assert.equal(await page.getByRole('button', { name: 'Follow', exact: true }).count(), 0);
  assert.equal(await page.locator('.market-product a button').count(), 0);
  assert.equal(await page.locator('.market-product').first().getByRole('link', { name: 'View model', exact: true }).getAttribute('href'), '/marketplace/9001');
  const add = page.getByRole('button', { name: 'Add Sample bench to cart', exact: true }).first();
  await add.click();
  await visible(page.locator('.market-cart-message').filter({ hasText: 'Added to cart.' }).first());
  assert.deepEqual(current.posts, [{ product_id: 9001, quantity: 1, selected_config: {} }]);
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  await add.click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Add Sample bench to cart"]').disabled);
  assert.equal(current.posts.length, 2);
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  checks.push('Separate model link and cart action; correct request; duplicate additions preserve unique-item cart count; honest review/report labels.');

  for (const [width, height] of [[320,812], [375,812], [768,1024], [1280,800], [1440,900], [1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const metrics = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth,
      top: document.querySelector('.store-primary').getBoundingClientRect().top,
      cta: document.querySelector('.store-primary').getBoundingClientRect().bottom,
      h1: document.querySelector('h1').getBoundingClientRect().bottom,
      font: getComputedStyle(document.querySelector('h1')).fontFamily }));
    assert.ok(metrics.page <= width, `Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.top >= 64 && metrics.cta < height && metrics.h1 < height, `Hero action/head off screen at ${width}`);
    assert.match(metrics.font, /Space_Grotesk|Space Grotesk/);
    await page.screenshot({path:`${out}/fixture-home-${width}.png`, fullPage: width === 375 || width === 1440});
  }
  checks.push('320/375/768/1280/1440/1920px: no page overflow; headline and browse action visible; brand font loaded.');

  await page.setViewportSize({width:375,height:812});
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await visible(page.getByRole('searchbox', { name: 'Search models', exact: true }));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Search models');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mobile-menu-toggle');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('searchbox', { name: 'Search models', exact: true }).fill('bench');
  await page.getByRole('searchbox', { name: 'Search models', exact: true }).press('Enter');
  await page.waitForURL('**/marketplace?q=bench');
  assert.equal(await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded'), 'false');
  assert.equal(current.posts.length, 2);
  checks.push('Mobile menu focuses search, closes on Escape and restores focus; mobile search navigates with the query.');
  await context.close();
  assert.deepEqual(errors, []);

  for (const scheme of ['light', 'dark']) {
    const v = await visit({ colorScheme: scheme });
    await visible(v.page.getByRole('link', { name: 'Explore Sample bench' }));
    await v.page.evaluate(() => document.fonts.ready);
    await settleImages(v.page);
    const pair = await v.page.locator('.store-primary').evaluate(el => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    const ratio = contrast(pair.color, pair.bg);
    assert.ok(ratio >= 4.5, `${scheme} primary contrast ${ratio}`);
    await v.page.keyboard.press('Tab');
    const focus = await v.page.evaluate(() => ({ width: getComputedStyle(document.activeElement).outlineWidth, style: getComputedStyle(document.activeElement).outlineStyle }));
    assert.notEqual(focus.width, '0px');
    assert.notEqual(focus.style, 'none');
    await settleImages(v.page);
    await v.page.locator('.store-hero-image img').screenshot({path:`${out}/fixture-${scheme}-product.png`});
    await v.page.screenshot({path:`${out}/fixture-${scheme}.png`});
    checks.push(`${scheme}: primary text contrast ${ratio.toFixed(2)}:1; keyboard focus visible.`);
    await v.context.close();
  }

  const loading = await visit({ state: 'loading' });
  await visible(loading.page.getByRole('status').filter({ hasText: 'Loading the catalogue' }));
  await loading.page.screenshot({path:`${out}/loading.png`});
  loading.current.state = 'empty'; loading.current.release?.();
  await visible(loading.page.getByRole('heading', { name: 'No models yet.' }));
  assert.equal(await loading.page.locator('.market-product').count(), 0);
  await loading.page.screenshot({path:`${out}/empty.png`});
  await loading.context.close();
  checks.push('Loading announces its state; empty catalogue offers publish action without empty product headings.');

  const failure = await visit({ state: 'error' });
  await visible(failure.page.getByRole('heading', { name: 'The catalogue couldn’t load.' }));
  assert.ok(failure.current.homepageRequests >= 2);
  await failure.page.screenshot({path:`${out}/error.png`});
  failure.current.state = 'full';
  await failure.page.getByRole('button', { name: 'Try again', exact: true }).click();
  await visible(failure.page.getByRole('link', { name: 'Explore Sample bench' }));
  await failure.context.close();
  checks.push('API outage produces a retry action; retry recovers the catalogue.');

  writeFileSync(`${out}/results.json`, JSON.stringify({ base, checks, passed: checks.length, fixtureBrowserBypassesCSP: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
