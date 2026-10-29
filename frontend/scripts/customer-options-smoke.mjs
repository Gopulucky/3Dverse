/** Isolated API fixture checks. Does not verify Firebase, providers or live data. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', bypassCSP: true });
const user = { id: 99, email: 'qa@example.test', role: 'customer' };
await context.addInitScript(user => {
  localStorage.setItem('token', 'qa-fixture-only');
  localStorage.setItem('user', JSON.stringify(user));
}, user);
const requests = [];
const catalogueRequests = [];
const cartPosts = [];
const productUpdates = [];
const product = { id: 9001, title: 'QA multi-format model', price: 120, base_print_price: 450, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true, is_mode_3_active: true, available_materials: ['PLA', 'PETG'], available_colors: ['blue', 'red'], available_sizes: ['S', 'M'], versions: [], media: [], category: 'Home Decor', status: 'draft' };
const catalogue = Array.from({ length: 25 }, (_, index) => ({ ...product, id: 9001 + index, title: `QA model ${index + 1}` }));
let creatorProduct = { ...product, currency: 'USD', price: 12, base_print_price: 45 };
const order = { id: 42, status: 'pending_payment', created_at: '2026-10-29T12:00:00Z', currency: 'INR', total: 450, subtotal: 450, shipping_cost: 0, items: [] };
let ordersFixture = [order];
let detailOrder = order;
let downloadFailure = false;
const downloads = [];

await context.route('**/api/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const send = json => route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
  if (url.pathname.endsWith('/products/creator')) return send([creatorProduct]);
  if (url.pathname === '/api/products/9001' && request.method() === 'PUT') {
    productUpdates.push(request.postDataJSON());
    creatorProduct = { ...creatorProduct, ...request.postDataJSON() };
    return send(creatorProduct);
  }
  if (url.pathname.endsWith('/marketplace/products')) {
    catalogueRequests.push(Object.fromEntries(url.searchParams));
    if (url.searchParams.get('q') === 'outage') return route.fulfill({ status: 500, json: { detail: 'QA outage' } });
    if (url.searchParams.get('q') === 'empty') return send([]);
    const skip = Number(url.searchParams.get('skip') || 0);
    return send(catalogue.slice(skip, skip + Number(url.searchParams.get('limit') || 20)));
  }
  if (url.pathname.endsWith('/marketplace/products/9001')) return send(product);
  if (url.pathname.endsWith('/cart/items') && request.method() === 'POST') {
    cartPosts.push(request.postDataJSON());
    return send({ items: [{ id: 1, product, quantity: 1, selected_config: request.postDataJSON().selected_config }] });
  }
  if (url.pathname.endsWith('/cart/')) return send({ items: [] });
  if (/\/downloads\/products\/\d+\/model$/.test(url.pathname)) {
    downloads.push({ path: url.pathname, authorization: request.headers().authorization });
    if (downloadFailure) return route.fulfill({ status: 403, json: { detail: 'QA file unavailable' } });
    return route.fulfill({ body: 'solid fixture\nendsolid fixture', contentType: 'application/octet-stream', headers: { 'content-disposition': 'attachment; filename="fixture.stl"' } });
  }
  if (url.pathname.endsWith('/orders/')) return send(ordersFixture);
  if (url.pathname.endsWith('/orders/42')) return send(detailOrder);
  if (url.pathname.endsWith('/return-policy')) return send({ policy: 'defect_reprint', window_open: false, window_closes_at: null, already_reported: false, items: [] });
  if (url.pathname.endsWith('/users/me')) return send(user);
  if (url.pathname.endsWith('/onboarding/type')) {
    requests.push(request.postDataJSON());
    user.role = 'creator';
    return send({ creator_type: 'designer', role: 'creator', locked: true });
  }
  if (url.pathname.endsWith('/onboarding/status')) return send({ creator_type: 'designer', locked: true });
  return send([]);
});
try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/marketplace?format=physical`);
  await page.locator('.market-product').first().waitFor();
  assert.equal(await page.locator('.market-product').count(), 20);
  assert.equal(catalogueRequests.at(-1).format, 'physical');
  assert.equal(catalogueRequests.at(-1).limit, '21');
  assert.ok((await page.locator('.market-product').first().innerText()).includes('\u20b9450.00'));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.waitForURL('**page=2');
  await page.getByRole('link', { name: 'QA model 21', exact: true }).waitFor();
  assert.equal(await page.locator('.market-product').count(), 5);
  assert.equal(catalogueRequests.at(-1).skip, '20');
  assert.equal(await page.getByRole('button', { name: 'Next page', exact: true }).isDisabled(), true);
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('price_asc');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.waitForURL('**sort=price_asc**');
  await page.getByRole('link', { name: 'QA model 1', exact: true }).waitFor();
  assert.equal(catalogueRequests.at(-1).currency, 'INR');
  assert.equal(catalogueRequests.at(-1).skip, '0');
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('outage');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('heading', { name: 'The catalogue couldn’t load.' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'No products match these filters.' }).count(), 0);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('empty');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('heading', { name: 'No products match these filters.' }).waitFor();
  await page.goto(`${base}/marketplace/9001`);
  await page.getByRole('combobox', { name: 'What are you buying?' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add to cart', exact: true }).isDisabled(), true);
  await page.getByRole('combobox', { name: 'What are you buying?' }).selectOption('physical');
  await page.getByRole('combobox', { name: 'Material', exact: true }).selectOption('PETG');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Added to cart.' }).waitFor();
  assert.deepEqual(cartPosts.at(-1), { product_id: 9001, quantity: 1, selected_config: { material: 'PETG', color: 'blue', size: 'S', purchase_type: 'physical' } });
  await page.getByRole('combobox', { name: 'What are you buying?' }).selectOption('digital');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Added to cart.' }).waitFor();
  assert.deepEqual(cartPosts.at(-1).selected_config, { purchase_type: 'digital' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(`${base}/orders`);
  await page.getByRole('link', { name: 'Continue payment', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Continue payment', exact: true }).getAttribute('href'), '/checkout?order_id=42');
  await page.goto(`${base}/orders/42`);
  await page.getByText('The return deadline is unavailable until delivery is recorded.', { exact: false }).waitFor();
  assert.equal(await page.getByText('This window has closed', { exact: false }).count(), 0);
  const digitalItem = { id: 1, product_id: 9001, quantity: 1, price_at_purchase: 120, product, selected_config: { purchase_type: 'digital' } };
  const paid = { ...order, id: 51, status: 'paid', payment_verified_at: '2026-10-29T12:00:00Z', items: [digitalItem] };
  ordersFixture = [paid,
    { ...paid, id: 52, items: [{ ...digitalItem, selected_config: { purchase_type: 'physical' } }] },
    { ...paid, id: 53, status: 'pending_payment' },
    { ...paid, id: 54, payment_verified_at: null },
    { ...paid, id: 55, currency: 'USD', payment_verified_at: null }];
  await page.goto(`${base}/orders`);
  await page.getByRole('button', { name: 'Download 3D file', exact: true }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download 3D file', exact: true }).count(), 2, 'physical, pending and unverified INR lines have no download action');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download 3D file', exact: true }).first().click();
  await downloadEvent;
  assert.deepEqual(downloads.at(-1), { path: '/api/downloads/products/9001/model', authorization: 'Bearer qa-fixture-only' });
  downloadFailure = true;
  await page.getByRole('button', { name: 'Download 3D file', exact: true }).first().click();
  await page.getByRole('status').filter({ hasText: 'QA file unavailable' }).waitFor();
  detailOrder = { ...paid, id: 42 };
  await page.goto(`${base}/orders/42`);
  await page.getByRole('button', { name: 'Download 3D file', exact: true }).waitFor();
  detailOrder = { ...detailOrder, payment_verified_at: null };
  await page.reload();
  await page.getByText('QA multi-format model', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download 3D file', exact: true }).count(), 0);
  await page.goto(`${base}/sell`);
  await page.getByRole('heading', { name: 'Sell with 3DVerse', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Creator path' }).selectOption('designer');
  await page.getByRole('button', { name: 'Set up my creator account', exact: true }).click();
  await page.waitForURL('**/creator/dashboard');
  assert.deepEqual(requests, [{ creator_type: 'designer' }]);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('user')).role), 'creator');
  await page.goto(`${base}/creator/products/9001`);
  await page.getByRole('button', { name: 'Reprice this listing in INR', exact: true }).waitFor();
  assert.match(await page.getByText('Price currency:', { exact: false }).innerText(), /USD/);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('button')?.disabled);
  await page.getByText('Product saved successfully', { exact: false }).waitFor();
  assert.equal(productUpdates.at(-1).currency, 'USD');
  await page.getByRole('button', { name: 'Reprice this listing in INR', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Digital file price' }).inputValue(), '');
  await page.getByRole('spinbutton', { name: 'Digital file price' }).fill('199');
  await page.getByRole('spinbutton', { name: 'Physical print price' }).fill('599');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Price currency: INR', { exact: true }).waitFor();
  assert.equal(productUpdates.at(-1).currency, 'INR');
  assert.equal(productUpdates.at(-1).price, 199);
  assert.equal(productUpdates.at(-1).base_print_price, 599);
  assert.deepEqual(errors, []);
  console.log('Catalogue pagination, currency-scoped filters, error/empty distinction, explicit product options, mobile width, payment resume, delivery deadlines, authenticated digital downloads and deliberate legacy repricing passed.');
  console.log('Seller entry uses the existing onboarding endpoint and refreshes the server role before entering Studio.');
} finally { await browser.close(); }
