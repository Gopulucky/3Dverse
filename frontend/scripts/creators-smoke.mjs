/**
 * Creator page, following, the notification bell, image captions and the country
 * preference, against isolated API fixtures. Does not verify a real backend,
 * real alerts being created, or real payments (orders are always charged in INR).
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });

const creator = { id: 7, name: 'Gopu Hardik', avatar_url: null, bio: 'I design tabletop pieces.', member_since: '2026-01-05T00:00:00Z', product_count: 1 };
const product = {
  id: 9100, creator_id: 7, creator_name: 'Gopu Hardik', title: 'QA dice tower', description: 'A dice tower.', category: 'Tabletop',
  price: 199, currency: 'INR', is_mode_2_active: true, digital_download_enabled: true, versions: [],
  media: [
    { id: 1, media_url: 'http://fixture.test/front.svg', media_type: 'image', is_primary: true, caption: 'Front view, printed in PETG' },
    { id: 2, media_url: 'http://fixture.test/side.svg', media_type: 'image', is_primary: false, caption: null },
  ],
};

const log = { follows: [], reads: [], profileSaves: [] };
const state = { followers: 3, following: false, unread: 1 };
const notice = { id: 5, title: 'New design from Gopu Hardik', message: 'Castle keep', type: 'new_design', read: false, data: { product_id: 9100, creator_id: 7 }, created_at: '2026-11-25T10:00:00Z' };

async function open({ signedInAs = null, country } = {}) {
  const context = await browser.newContext({ bypassCSP: true, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(({ user, country }) => {
    if (user) { localStorage.setItem('token', 'qa-fixture-only'); localStorage.setItem('user', JSON.stringify(user)); }
    if (country) localStorage.setItem('bs3d-country', country);
  }, { user: signedInAs, country });
  await context.route('http://fixture.test/**', (route) => route.fulfill({
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#0E5E6F"/></svg>',
    contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' },
  }));
  await context.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const send = (json, status = 200) => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } });
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    const path = url.pathname;
    if (path.endsWith('/marketplace/products/9100')) return send(product);
    if (path.endsWith('/creators/7')) return send({ ...creator, follower_count: state.followers });
    if (path.endsWith('/creators/7/products')) return send([product]);
    if (/\/creators\/\d+$/.test(path)) return send({ detail: 'Creator not found' }, 404);
    if (path.endsWith('/creators/7/follow')) {
      if (method === 'POST') { log.follows.push('POST'); if (!state.following) state.followers += 1; state.following = true; }
      if (method === 'DELETE') { log.follows.push('DELETE'); if (state.following) state.followers -= 1; state.following = false; }
      return send({ following: state.following, follower_count: state.followers });
    }
    if (path.endsWith('/notifications/unread-count')) return send({ count: state.unread });
    if (path.endsWith('/notifications/') && method === 'GET') return send([{ ...notice, read: state.unread === 0 }]);
    if (/\/notifications\/\d+\/read$/.test(path)) { log.reads.push(path); state.unread = 0; return send({ status: 'success' }); }
    if (path.endsWith('/users/me') && method === 'PUT') { log.profileSaves.push(request.postDataJSON()); return send({ ...signedInAs, ...request.postDataJSON() }); }
    if (path.endsWith('/users/me')) return send(signedInAs ?? {});
    if (path.endsWith('/cart/')) return send({ items: [] });
    return send([]);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

try {
  // --- A shopper in Australia, signed out -----------------------------------------------
  {
    const { context, page, errors } = await open({ country: 'AU' });
    await page.goto(`${base}/marketplace/9100`);
    await page.getByRole('heading', { level: 1, name: 'QA dice tower' }).waitFor();
    const price = page.locator('[data-flow="product-price"]');
    await page.waitForFunction(() => /≈ A\$/.test(document.querySelector('[data-flow="product-price"]')?.textContent ?? ''));
    assert.match(await price.innerText(), /≈ A\$3\.49/, 'about A$3.49 for ₹199 at the indicative rate');
    assert.match(await page.locator('[data-flow="charged-note"]').innerText(), /₹199(?![d.])/, 'the rupee amount that is charged is stated');
    if (process.env.SMOKE_SHOTS) await page.screenshot({ path: `${process.env.SMOKE_SHOTS}/product-au.png` });

    // Switching country in the header changes the display at once.
    await page.getByRole('button', { name: /Country and currency/ }).click();
    await page.getByLabel('Country', { exact: true }).selectOption('IN');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-flow="charged-note"]'));
    assert.match(await price.innerText(), /^₹199(?![d.])/);
    assert.equal(await page.evaluate(() => localStorage.getItem('bs3d-country')), 'IN', 'the choice is remembered');

    // Image captions show under the picture the shopper opens.
    await page.getByRole('button', { name: 'Show photo 1 of 2' }).click();
    assert.equal(await page.locator('[data-flow="image-caption"]').innerText(), 'Front view, printed in PETG');
    await page.getByRole('button', { name: 'Show photo 2 of 2' }).click();
    assert.equal(await page.locator('[data-flow="image-caption"]').count(), 0, 'no caption, no empty line');

    // Following needs an account: signed-out shoppers are sent to sign in and come back.
    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await page.waitForURL(/\/login\?next=%2Fmarketplace%2F9100/);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // --- The creator page -------------------------------------------------------------------
  {
    const { context, page, errors } = await open({ signedInAs: { id: 99, email: 'fan@example.test', role: 'customer' } });
    await page.goto(`${base}/marketplace/9100`);
    await page.getByRole('heading', { level: 1, name: 'QA dice tower' }).waitFor();
    await page.locator('[data-flow="creator-link"]').click();
    await page.waitForURL('**/creators/7');
    await page.getByRole('heading', { level: 1, name: 'Gopu Hardik' }).waitFor();
    await page.getByRole('link', { name: 'QA dice tower' }).first().waitFor();
    assert.equal(await page.getByTestId('follower-count').innerText(), '3');
    // SMOKE_SHOTS=<folder> saves screenshots for a visual review; it changes nothing else.
    if (process.env.SMOKE_SHOTS) await page.screenshot({ path: `${process.env.SMOKE_SHOTS}/creator-page.png` });

    const follow = page.getByRole('button', { name: 'Follow', exact: true });
    await follow.click();
    await page.getByRole('button', { name: 'Following', exact: true }).waitFor();
    assert.deepEqual(log.follows, ['POST']);
    await page.waitForFunction(() => document.querySelector('[data-testid="follower-count"]')?.textContent === '4');
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await page.getByRole('button', { name: 'Follow', exact: true }).waitFor();
    assert.deepEqual(log.follows, ['POST', 'DELETE']);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // --- A creator looking at their own page cannot follow themselves; unknown pages are honest ---
  {
    const { context, page } = await open({ signedInAs: { id: 7, email: 'gopu@example.test', role: 'creator' } });
    await page.goto(`${base}/creators/7`);
    await page.getByRole('heading', { level: 1, name: 'Gopu Hardik' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Follow/ }).count(), 0);
    await page.goto(`${base}/creators/999`);
    await page.getByRole('heading', { name: "This creator page isn't available." }).waitFor();
    await context.close();
  }

  // --- The bell ---------------------------------------------------------------------------------
  {
    const { context, page } = await open({ signedInAs: { id: 99, email: 'fan@example.test', role: 'customer' } });
    await page.goto(`${base}/marketplace`);
    // Alerts live in the account menu; the account button says when one is waiting.
    const account = page.getByRole('button', { name: 'Account and portals, 1 unread notification' });
    await account.waitFor();
    await account.click();
    await page.getByRole('menuitem', { name: 'Notifications, 1 unread' }).click();
    await page.getByRole('dialog', { name: 'Notifications' }).getByRole('button', { name: /New design from Gopu Hardik/ }).click();
    await page.waitForURL('**/marketplace/9100');
    assert.deepEqual(log.reads, ['/api/notifications/5/read'], 'opening an alert marks it read');
    await page.getByRole('button', { name: 'Account and portals', exact: true }).waitFor();
    await context.close();
  }

  // --- Sign-up asks for a country and remembers it ------------------------------------------------
  {
    const { context, page } = await open();
    await page.goto(`${base}/register`);
    const select = page.locator('#signup-country');
    await select.waitFor();
    assert.equal(await select.inputValue(), 'IN');
    await select.selectOption('US');
    assert.equal(await page.evaluate(() => localStorage.getItem('bs3d-country')), 'US');
    await context.close();
  }

  // --- On a phone the header stays inside the screen; country is in the footer, alerts in the account menu ---
  {
    const { context, page } = await open({ signedInAs: { id: 99, email: 'fan@example.test', role: 'customer' } });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`${base}/marketplace`);
    await page.locator('footer').getByRole('button', { name: /Country and currency/ }).waitFor();
    await page.getByRole('button', { name: /^Account and portals/ }).click();
    await page.getByRole('menuitem', { name: /^Notifications/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll at 320px');
    await context.close();
  }

  console.log('creators-smoke: ok');
} finally {
  await browser.close();
}
