/**
 * Checkout page + Razorpay Checkout.js flow, with intercepted API fixtures and a stub
 * Checkout.js. It does NOT contact Razorpay, a real backend, or move any money, so it
 * proves the page's behaviour and that the site's CSP lets Razorpay's script load,
 * not that a real payment works. CSP is deliberately NOT bypassed here.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const user = { id: 5, email: 'buyer@example.test', full_name: 'Test Buyer', role: 'customer' };

const product = { id: 1, title: 'Wall hook', price: 29, base_print_price: null, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true,
  is_mode_3_active: false, is_mode_4_active: false, media: [] };
const cart = { id: 1, items: [{ id: 11, quantity: 2, selected_config: { purchase_type: 'digital' }, product }] };
const preparedFor = (holdMs) => ({ order_id: 77, key_id: 'rzp_test_fixture00001', razorpay_order_id: 'order_fixture1', amount_minor: 5800, total: 58, subtotal: 58,
  hold_expires_at: new Date(Date.now() + holdMs).toISOString(),
  shipping_cost: 0, currency: 'INR', payment_status: 'created', shipping_address: null,
  items: [{ title: 'Wall hook', purchase_type: 'digital', quantity: 2, unit_price: 29 }] });
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

// A stand-in for https://checkout.razorpay.com/v1/checkout.js. Its behaviour is chosen per test.
const CHECKOUT_JS = `
window.__rzp = { opens: [], mode: 'success' };
window.Razorpay = class {
  constructor(options) { this.o = options; this.handlers = {}; window.__rzp.opens.push(options); }
  on(event, callback) { this.handlers[event] = callback; }
  open() {
    const mode = window.__rzp.mode;
    if (mode === 'success') setTimeout(() => this.o.handler({ razorpay_payment_id: 'pay_fixture1', razorpay_order_id: this.o.order_id, razorpay_signature: 'sig_fixture1' }), 30);
    if (mode === 'fail-then-close') setTimeout(() => { this.handlers['payment.failed']?.({ error: { description: 'Card declined by the bank.' } }); this.o.modal.ondismiss(); }, 30);
    if (mode === 'close') setTimeout(() => this.o.modal.ondismiss(), 30);
  }
};`;

async function session({ available = true, verifyStatus = 'paid', orderVerifiedAfter = 1, holdMs = 14 * 60 * 1000, userAgent, cartItems = cart.items, hold = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(userAgent ? { userAgent } : {}) }); // CSP enforced
  const seen = { verify: [], create: 0, orderPolls: 0, scriptRequests: 0 };
  await context.addInitScript(u => { localStorage.setItem('token', 'qa-only-token'); localStorage.setItem('user', JSON.stringify(u)); }, user);
  await context.route('https://checkout.razorpay.com/**', route => { seen.scriptRequests += 1; route.fulfill({ contentType: 'application/javascript', body: CHECKOUT_JS }); });
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const send = (json, status = 200) => route.fulfill({ json, status, headers: { 'access-control-allow-origin': '*' } });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path.endsWith('/users/me')) return send(user);
    if (path.endsWith('/cart/') && method === 'GET') return send({ ...cart, items: cartItems });
    if (path.endsWith('/checkout/hold')) return send({ hold });
    if (path.endsWith('/checkout/status')) return send({ available, provider: 'razorpay' });
    if (path.endsWith('/checkout/create-payment-intent')) { seen.create += 1; return send(preparedFor(holdMs)); }
    if (path.endsWith('/checkout/verify')) { seen.verify.push(request.postDataJSON()); return send({ order_id: 77, status: verifyStatus }); }
    if (path.endsWith('/orders/77')) { seen.orderPolls += 1; return send({ id: 77, payment_verified_at: seen.orderPolls >= orderVerifiedAfter ? '2026-11-14T10:00:00' : null }); }
    return send([]);
  });
  const page = await context.newPage();
  const consoleErrors = [];
  // Only violations whose *blocked URL* is Razorpay's count; Vercel Analytics/Speed Insights
  // scripts are blocked by the existing CSP in dev and are unrelated to checkout.
  page.on('console', m => {
    const text = m.text(), blocked = (text.match(/'(https?:[^']+)'/) || [])[1] || '';
    if (m.type() === 'error' && /Content Security Policy/i.test(text) && /razorpay\.com/i.test(blocked)) consoleErrors.push(text);
  });
  return { context, page, seen, consoleErrors };
}

async function reachPayment(page) {
  await page.goto(`${base}/checkout`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.locator('[data-flow="payment"]').waitFor({ timeout: 20000 });
}

try {
  // ---- 1. Happy path: pay in the Razorpay window, our API verifies it ----
  {
    const { context, page, seen, consoleErrors } = await session();
    await reachPayment(page);
    assert.equal(seen.scriptRequests, 0, 'Checkout.js is not fetched until someone is about to pay');
    const text = await page.locator('[data-flow="checkout"]').innerText();
    assert.ok(text.includes('Order #77') && /58\.00/.test(text), 'shows the saved order and the amount to pay');
    assert.ok(!/stripe/i.test(await page.content()), 'no Stripe wording or markup remains on the page');
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.locator('[data-flow="payment"][data-state="confirmed"]').waitFor({ timeout: 10000 });
    assert.equal(seen.scriptRequests, 1, 'Checkout.js was loaded from Razorpay once');
    assert.deepEqual(consoleErrors, [], 'the site CSP did not block Razorpay');
    const options = await page.evaluate(() => ({ ...window.__rzp.opens[0], handler: undefined, modal: undefined }));
    assert.equal(options.key, 'rzp_test_fixture00001');
    assert.equal(options.order_id, 'order_fixture1');
    assert.equal(options.amount, 5800, 'amount is the saved minor-unit amount, not recomputed in the browser');
    assert.equal(options.currency, 'INR');
    assert.equal(options.prefill.email, 'buyer@example.test');
    assert.deepEqual(options.config.display.sequence, ['block.upi_block', 'block.other_block'], 'UPI is offered first');
    assert.deepEqual(options.config.display.blocks.upi_block.instruments, [{ method: 'upi' }]);
    assert.ok(options.timeout >= 60 && options.timeout <= 900, `the payment window times out within the hold (${options.timeout}s)`);
    assert.equal(options.redirect, undefined, 'desktop uses the popup, not the redirect flow');
    assert.equal(options.callback_url, undefined);
    assert.deepEqual(seen.verify, [{ order_id: 77, razorpay_payment_id: 'pay_fixture1', razorpay_order_id: 'order_fixture1', razorpay_signature: 'sig_fixture1' }],
      'the browser result is sent to our API to verify, never trusted on its own');
    assert.ok((await page.locator('[data-flow="payment"]').innerText()).includes('Payment confirmed'));
    assert.equal(await page.evaluate(() => sessionStorage.getItem('checkout-attempt-5')), null, 'the saved attempt is cleared once paid');
    await context.close();
  }

  // ---- 2. A failed try, then closing the window: honest message, and paying again works ----
  {
    const { context, page, seen } = await session();
    await reachPayment(page);
    // Load the stub first, then choose how it behaves.
    await page.evaluate(() => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = resolve; s.onerror = reject; document.body.appendChild(s); }));
    await page.evaluate(() => { window.__rzp.mode = 'fail-then-close'; });
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.getByText('Card declined by the bank. You can try again.').waitFor({ timeout: 5000 });
    assert.equal(await page.locator('[data-flow="payment"]').getAttribute('data-state'), 'idle');
    assert.equal(seen.verify.length, 0, 'nothing is verified after a failed payment');
    assert.equal(await page.getByRole('button', { name: /^Pay/ }).isEnabled(), true, 'the customer can pay again');
    await page.evaluate(() => { window.__rzp.mode = 'close'; });
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.getByText(/closed before payment finished/).waitFor({ timeout: 5000 });
    assert.ok(!(await page.locator('[data-flow="checkout"]').innerText()).includes('Card declined'), 'a stale failure message is not reused');
    await page.evaluate(() => { window.__rzp.mode = 'success'; });
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.locator('[data-flow="payment"][data-state="confirmed"]').waitFor({ timeout: 10000 });
    assert.equal(seen.verify.length, 1);
    await context.close();
  }

  // ---- 3. Provider says "pending": we poll the order instead of claiming success ----
  {
    const { context, page, seen } = await session({ verifyStatus: 'pending', orderVerifiedAfter: 2 });
    await reachPayment(page);
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.locator('[data-flow="payment"][data-state="confirmed"]').waitFor({ timeout: 15000 });
    assert.ok(seen.orderPolls >= 2, `polled the order until the webhook confirmed it (${seen.orderPolls})`);
    await context.close();
  }

  // ---- 4. Payments not configured: honest state, no way to start a payment ----
  {
    const { context, page, seen } = await session({ available: false });
    await page.goto(`${base}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Payments are not available right now').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('[data-flow="checkout"]').getAttribute('data-state'), 'unavailable');
    assert.equal(seen.create, 0);
    await context.close();
  }
  // ---- 5. Phone: redirect mode, so a payment finished inside a UPI app still reaches our server ----
  {
    const { context, page } = await session({ userAgent: PHONE_UA });
    await reachPayment(page);
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.waitForFunction(() => window.__rzp?.opens.length === 1, null, { timeout: 10000 });
    const options = await page.evaluate(() => ({ redirect: window.__rzp.opens[0].redirect, callback_url: window.__rzp.opens[0].callback_url, upi: window.__rzp.opens[0].config.display.sequence[0] }));
    assert.equal(options.redirect, true);
    assert.match(options.callback_url, /\/api\/checkout\/callback$/);
    assert.equal(options.upi, 'block.upi_block', 'UPI is first on phones too');
    await context.close();
  }

  // ---- 6. An ended hold cannot be paid: no pay button, a clear way back ----
  {
    const { context, page } = await session({ holdMs: -60 * 1000 });
    await reachPayment(page);
    await page.getByText('no longer held').waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole('button', { name: /^Pay/ }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'go back to your cart' }).getAttribute('href'), '/cart');
    await context.close();
  }

  // ---- 7. The hold countdown is shown while paying ----
  {
    const { context, page } = await session({ holdMs: 600 * 1000 });
    await reachPayment(page);
    const text = await page.locator('[data-hold-countdown]').innerText();
    assert.match(text, /held for (9:5\d|10:00)/, `countdown starts near 10:00, saw "${text}"`);
    await context.close();
  }

  // ---- 8. Return page after a phone payment: polls until the order is verified ----
  {
    const { context, page, seen } = await session({ orderVerifiedAfter: 3 });
    await page.goto(`${base}/checkout/return?order_id=77`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-flow="payment-return"][data-state="verifying"]').waitFor({ timeout: 20000 });
    await page.locator('[data-flow="payment-return"][data-state="confirmed"]').waitFor({ timeout: 20000 });
    assert.ok(seen.orderPolls >= 3, `kept asking until the server confirmed (${seen.orderPolls})`);
    assert.equal(await page.getByRole('link', { name: 'View order' }).getAttribute('href'), '/orders/77');
    await context.close();
  }
  {
    const { context, page } = await session();
    await page.goto(`${base}/checkout/return`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-flow="payment-return"][data-state="unknown"]').waitFor({ timeout: 20000 });
    await context.close();
  }

  // ---- 9. An unpaid checkout is a banner on Orders and Cart, never a row in the order list ----
  {
    const live = { order_id: 77, hold_expires_at: new Date(Date.now() + 600 * 1000).toISOString(), total: 58, currency: 'INR' };
    const { context, page } = await session({ hold: live });
    for (const path of ['/orders', '/cart']) {
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      const banner = page.locator('[data-flow="hold-banner"]');
      await banner.waitFor({ timeout: 20000 });
      assert.equal(await banner.getByRole('link', { name: 'Complete payment' }).getAttribute('href'), '/checkout?order_id=77');
      assert.match(await banner.locator('[data-countdown]').innerText(), /^(9:5\d|10:00)$/);
    }
    await context.close();
    const none = await session({ hold: null });
    await none.page.goto(`${base}/orders`, { waitUntil: 'domcontentloaded' });
    await none.page.getByText('No orders yet').waitFor({ timeout: 20000 });
    assert.equal(await none.page.locator('[data-flow="hold-banner"]').count(), 0);
    await none.context.close();
  }

  // ---- 10. Cart: an unavailable line stays, says why, is left out of the total and blocks checkout ----
  {
    const items = [{ ...cart.items[0] }, { id: 12, quantity: 1, selected_config: { purchase_type: 'digital' }, product: { ...product, id: 2, title: 'Desk stand' }, unavailable_reason: 'Out of stock' }];
    const { context, page } = await session({ cartItems: items });
    await page.goto(`${base}/cart`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-line="12"]').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('[data-line="12"] [data-unavailable]').innerText(), 'Out of stock');
    assert.equal(await page.locator('[data-line="11"] [data-unavailable]').count(), 0);
    assert.match(await page.locator('[data-total]').innerText(), /58\.00/, 'only the buyable line is in the total');
    assert.equal(await page.getByRole('button', { name: 'Checkout' }).last().isDisabled(), true);
    assert.equal(await page.locator('[data-flow="cart"]').getAttribute('data-state'), 'blocked');
    await context.close();
  }
  console.log('checkout-razorpay-smoke: all checks passed');
} finally {
  await browser.close();
}
