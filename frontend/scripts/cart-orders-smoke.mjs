/** Cart and orders fixture tests (layout, quantity, coupon, filters, request counts); no real backend, payments or database. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ bypassCSP: true, viewport: { width: 1280, height: 900 } });
const user = { id: 5, email: 'buyer@example.test', role: 'customer' };
const counts = { cart: 0, me: 0, orders: 0 };
const imageRequests = [];
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const calls = [];
const product = (id, title, over = {}) => ({ id, title, price: 100, base_print_price: 300, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true,
  is_mode_3_active: true, is_mode_4_active: false,
  media: [{ id: id, product_id: id, media_type: 'image', is_primary: true, media_url: `/uploads/media/big-${id}.png`, thumb_url: id === 2 ? '/uploads/media/missing-thumb.webp' : `/uploads/media/small-${id}.webp` }], ...over });
let cart = { id: 1, items: [
  { id: 11, quantity: 2, selected_config: { purchase_type: 'digital' }, product: product(1, 'Wall hook') },
  { id: 12, quantity: 1, selected_config: { purchase_type: 'physical' }, product: product(2, 'Desk stand') },
] };
const line = (id, type) => ({ id, product_id: 1, quantity: 1, price_at_purchase: 100, selected_config: { purchase_type: type }, product: product(1, 'Wall hook') });
const base_order = { total: 100, currency: 'INR', created_at: '2026-11-01T10:00:00', payment_verified_at: '2026-11-01T10:01:00' };
const orders = [
  { ...base_order, id: 903, status: 'printing', items: [line(31, 'physical')] },
  { ...base_order, id: 902, status: 'paid', items: [line(21, 'digital')] },
  { ...base_order, id: 901, status: 'delivered', tracking_url: 'https://track.example.test/1', items: [line(11, 'physical')] },
  { ...base_order, id: 900, status: 'pending_payment', payment_verified_at: null, items: [line(41, 'physical')] },
  { ...base_order, id: 899, status: 'cancelled', items: [line(51, 'physical')] },
];
await context.addInitScript(u => {
  localStorage.setItem('token', 'qa-only-token');
  localStorage.setItem('user', JSON.stringify(u));
}, user);
await context.route('**/uploads/**', route => {
  const path = new URL(route.request().url()).pathname;
  imageRequests.push(path);
  if (path.includes('missing-thumb')) return route.fulfill({ status: 404 });
  return route.fulfill({ body: PIXEL, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
});
await context.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  const send = (json, status = 200) => route.fulfill({ json, status, headers: { 'access-control-allow-origin': '*' } });
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (path.endsWith('/users/me')) { counts.me += 1; return send(user); }
  if (path.endsWith('/cart/') && method === 'GET') { counts.cart += 1; return send(cart); }
  const item = path.match(/\/cart\/items\/(\d+)$/);
  if (item && method === 'PUT') {
    const body = request.postDataJSON(); calls.push(['PUT', Number(item[1]), body.quantity]);
    cart = { ...cart, items: cart.items.map(i => i.id === Number(item[1]) ? { ...i, quantity: body.quantity } : i) };
    return send(cart);
  }
  if (item && method === 'DELETE') { calls.push(['DELETE', Number(item[1])]); cart = { ...cart, items: cart.items.filter(i => i.id !== Number(item[1])) }; return send(cart); }
  if (path.endsWith('/cart/apply-coupon')) {
    const body = request.postDataJSON(); calls.push(['COUPON', body.code]);
    return body.code === 'TEN' ? send({ code: 'TEN', percent_off: 10, flat_off: null }) : send({ detail: 'Coupon not found' }, 404);
  }
  if (path.endsWith('/orders/') && method === 'GET') { counts.orders += 1; return send(orders); }
  return send([]);
});
const noSideways = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  const page = await context.newPage();

  // ---- Cart, desktop ----
  await page.goto(`${base}/cart`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-line="11"]').waitFor({ timeout: 20000 });
  assert.equal(counts.cart, 1, `navbar and page share one /api/cart/ request, saw ${counts.cart}`);
  assert.equal(counts.me, 1, `one /api/users/me request, saw ${counts.me}`);
  let text = await page.locator('main').innerText();
  assert.ok(text.includes('Cart') && text.includes('(2)'), 'cart heading shows the number of items, like the navbar badge');
  assert.ok(text.includes('Digital file · instant download') && text.includes('Physical print · delivered to you'));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-line] img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
  assert.ok(imageRequests.includes('/uploads/media/small-1.webp'), 'the cart loads the small copy');
  assert.ok(!imageRequests.includes('/uploads/media/big-1.png'), 'the full-size original is not downloaded for a cart row');
  assert.ok(imageRequests.includes('/uploads/media/missing-thumb.webp') && imageRequests.includes('/uploads/media/big-2.png'), 'a missing thumbnail falls back to the original');
  const total = page.locator('[data-total]');
  assert.match(await total.innerText(), /500\.00/, '2 x 100 + 300 = 500');

  await page.getByRole('button', { name: 'Increase quantity' }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-total]')?.textContent?.includes('600.00'), null, { timeout: 5000 });
  assert.deepEqual(calls.find(c => c[0] === 'PUT'), ['PUT', 11, 3]);
  await page.getByRole('button', { name: 'Decrease quantity' }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-total]')?.textContent?.includes('500.00'), null, { timeout: 5000 });

  await page.getByRole('button', { name: 'Have a coupon?' }).click();
  await page.getByLabel('Coupon code').fill('nope');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByText('Coupon not found').waitFor();
  await page.getByLabel('Coupon code').fill('TEN');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-total]')?.textContent?.includes('450.00'), null, { timeout: 5000 });
  assert.ok((await page.locator('aside').innerText()).includes('Coupon TEN'));

  await page.getByRole('button', { name: 'Remove Desk stand' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-line="12"]'), null, { timeout: 5000 });
  assert.deepEqual(calls.find(c => c[0] === 'DELETE'), ['DELETE', 12]);
  assert.match(await total.innerText(), /180\.00/, '2 x 100 less 10%');
  await page.getByRole('button', { name: 'Checkout' }).first().click();
  await page.waitForURL('**/checkout');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('coupon')), 'TEN');

  // ---- Cart, phone: fixed checkout bar, no sideways scroll, tall controls ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/cart`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-line="11"]').waitFor({ timeout: 20000 });
  assert.equal(await noSideways(page), true, 'cart has no sideways scroll at 375px');
  const bar = page.locator('[data-flow="cart-checkout-bar"]');
  await bar.waitFor();
  const barBox = await bar.boundingBox();
  assert.ok(barBox.y + barBox.height >= 811 && barBox.y > 400, 'checkout bar sits at the bottom of the screen');
  const heights = await page.getByRole('button', { name: /(Increase|Decrease) quantity|^Remove/ }).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  assert.ok(heights.length && heights.every(h => h >= 44), `quantity and remove buttons are 44px or taller: ${heights}`);
  const checkoutHeight = await bar.getByRole('button', { name: 'Checkout' }).evaluate(e => e.getBoundingClientRect().height);
  assert.ok(checkoutHeight >= 44);

  // ---- Cart: a line with no format blocks checkout and says why ----
  cart = { id: 1, items: [{ id: 13, quantity: 1, selected_config: null, product: product(3, 'Mystery') }] };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Format needed', { exact: false }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByRole('button', { name: 'Checkout' }).last().isDisabled(), true);
  await page.getByText('Some items have no format chosen', { exact: false }).waitFor();

  // ---- Cart: empty ----
  cart = { id: 1, items: [] };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByRole('main').getByRole('link', { name: 'Printed products' }).getAttribute('href'), '/marketplace?format=physical');
  assert.equal(await page.getByRole('main').getByRole('link', { name: 'Digital models' }).getAttribute('href'), '/marketplace?format=digital');

  // ---- Orders ----
  counts.me = 0;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/orders`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-order="903"]').waitFor({ timeout: 20000 });
  assert.equal(counts.orders, 1);
  assert.equal(counts.me, 1, 'one /api/users/me check on this page');
  const chip = name => page.getByRole('button', { name });
  assert.match(await chip(/^All/).innerText(), /5/);
  assert.match(await chip(/^In progress/).innerText(), /3/);
  assert.match(await chip(/^Delivered/).innerText(), /1/);
  assert.match(await chip(/^Cancelled/).innerText(), /1/);
  text = await page.locator('main').innerText();
  for (const phrase of ['Being printed', 'Ready to download', 'Delivered', 'Payment pending', 'Cancelled', 'Step 3 of 7']) assert.ok(text.includes(phrase), `shows "${phrase}"`);
  assert.ok(!/pending_payment|printing\b.*_/.test(text), 'raw status codes are not shown');
  assert.equal(await page.getByRole('link', { name: 'Continue payment' }).getAttribute('href'), '/checkout?order_id=900');
  assert.equal(await page.getByRole('link', { name: 'Track package' }).getAttribute('href'), 'https://track.example.test/1');
  assert.equal(await page.getByRole('button', { name: 'Download 3D file' }).count(), 1, 'only the paid digital order offers a download');
  assert.equal(await page.locator('[data-order="902"] [role="progressbar"]').count(), 0, 'digital orders have no print progress bar');
  await chip(/^Delivered/).click();
  assert.equal(await page.locator('[data-order]').count(), 1);
  await chip(/^Cancelled/).click();
  await page.locator('[data-order="899"]').waitFor();
  await chip(/^In progress/).click();
  assert.equal(await page.locator('[data-order]').count(), 3);

  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await noSideways(page), true, 'orders has no sideways scroll at 375px');
  const buttonHeights = await page.locator('[data-order="900"]').getByRole('link').evaluateAll(els => els.filter(e => /Continue payment|View details/.test(e.textContent)).map(e => Math.round(e.getBoundingClientRect().height)));
  assert.ok(buttonHeights.length === 2 && buttonHeights.every(h => h >= 44), `order actions are 44px or taller: ${buttonHeights}`);

  // ---- Orders: empty ----
  orders.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'No orders yet' }).waitFor({ timeout: 20000 });
  console.log('PASS cart and orders: layout, optimistic quantity, coupon, blocked states, filters, single requests and phone width');
} finally { await context.close(); await browser.close(); }
