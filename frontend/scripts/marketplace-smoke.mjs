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
  id: 9001, title: 'Sample bench', category: 'Home Decor', price: 120, base_print_price: 450, currency: 'INR', digital_download_enabled: true, is_mode_3_active: true,
  creator_name: 'QA catalogue', avg_rating: 4.5, review_count: 2,
  is_mode_2_active: true, is_featured: true,
  media: [{ media_url: '/qa-bench.jpg', thumb_url: '/qa-bench-small.webp', is_primary: true }],
  versions: [{ is_latest: true, printability_report: { status: 'pass' } }],
};
const products = Array.from({ length: 12 }, (_, index) => ({ ...product, id: 9001 + index, title: index ? `Sample model ${index + 1}` : product.title }));
const full = {
  featured: products, trending: products, new_arrivals: products,
  categories: ['Home Decor', 'Tabletop', 'Miniatures', 'Architecture', 'Gadgets', 'Jewelry'].map(name => ({ name })),
  popular_creators: [{ name: 'QA catalogue', role: 'Test fixture', initials: 'QA' }],
};
const empty = { featured: [], trending: [], new_arrivals: [], categories: [], popular_creators: [] };
const checks = [];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
async function visit({ state = 'full', authenticated = false, colorScheme = 'light', viewport = { width: 1440, height: 900 }, reducedMotion = 'reduce' } = {}) {
  // The production CSP deliberately blocks a cross-port HTTP API on localhost.
  // Bypass it only inside this isolated fixture browser; deployment uses HTTPS.
  const context = await browser.newContext({ reducedMotion, colorScheme, viewport, bypassCSP: true });
  const current = { state, posts: [], waitlist: [], audience: [], homepageRequests: 0, catalogueRequests: [] };
  if (authenticated) await context.addInitScript(() => {
    localStorage.setItem('token', 'qa-only-token');
    localStorage.setItem('user', JSON.stringify({ id: 99, email: 'qa@example.test', role: 'customer' }));
  });
  await context.route(/qa-bench(-small)?.(jpg|webp)$/, route => route.fulfill({ body: image, contentType }));
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const send = (json, status = 200) => route.fulfill({ json, status, headers: { 'access-control-allow-origin': '*' } });
    if (path.endsWith('/homepage')) {
      current.homepageRequests++;
      if (current.state === 'error') return send({ detail: 'QA simulated outage' }, 503);
      if (current.state === 'loading') await new Promise(resolve => { current.release = resolve; });
      return send(current.state === 'empty' ? empty : current.state === 'printed' ? { ...full, availability: { checkout: true, printed: true } } : full);
    }
    if (path.endsWith('/audience') && request.method() === 'POST') {
      current.audience.push(request.postDataJSON());
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (path.endsWith('/waitlist') && request.method() === 'POST') {
      current.waitlist.push(request.postDataJSON());
      return send({ status: 'joined' });
    }
    if (path.endsWith('/suggestions')) return send({ products: [product], categories: ['Home Decor'] });
    if (path.endsWith('/products')) {
      current.catalogueRequests.push(Object.fromEntries(new URL(request.url()).searchParams));
      return send(products);
    }
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
  assert.ok(await page.locator('.storefront .market-product-image img').first().evaluate(image => image.complete && image.naturalWidth > 0), 'Product fixture image must load before visual capture.');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function contrast(a, b) {
  const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
try {
  const { page, context, current, errors } = await visit({ authenticated: true });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  await page.evaluate(() => document.fonts.ready);
  await settleImages(page);
  // Home: products lead the page and the copy stays short.
  assert.equal(await page.locator('h1').innerText(), 'Ideas you can hold.');
  assert.match(await page.locator('.home-hero').innerText(), /Digital models ready for your own printer\. Finished prints are coming soon\./);
  // Product cards follow the hero directly; no 3D canvas, and nothing hidden under reduced motion.
  assert.equal(await page.evaluate(() => document.querySelector('.home-hero').nextElementSibling.id), 'featured');
  assert.equal(await page.locator('.storefront canvas').count(), 0);
  assert.equal(await page.locator('[data-reveal]').count(), 0);
  const tiles = page.locator('.home-tiles');
  assert.equal(await tiles.getByRole('link', { name: /Printed products/ }).getAttribute('href'), '/marketplace?format=physical');
  assert.equal(await tiles.getByRole('link', { name: /Digital models/ }).getAttribute('href'), '/marketplace?format=digital');
  assert.equal(await page.getByRole('heading', { name: 'How shopping works' }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Popular creators' }).count(), 0);
  assert.equal(await page.getByRole('navigation', { name: 'Shop by category' }).getByRole('link', { name: 'Home Decor' }).count(), 1);
  // The name: a clear ampersand (Inter) everywhere; built in print layers only where it is large.
  const marks = await page.evaluate(() => [...document.querySelectorAll('nav .wordmark-amp, footer .wordmark-amp')].map(amp => [
    amp.closest('footer') ? 'footer' : 'header', amp.parentElement.textContent,
    /inter/i.test(getComputedStyle(amp).fontFamily), getComputedStyle(amp).backgroundImage.startsWith('repeating-linear-gradient')]));
  assert.deepEqual(marks, [['header', 'buy&sell3d', true, false], ['footer', 'buy&sell3d', true, true]]);
  // Vercel Web Analytics and Speed Insights: same-origin scripts, loaded once and deferred (they 404 off Vercel, harmlessly).
  const insightScripts = await page.locator('script[src^="/_vercel/"]').evaluateAll(els => els.map(e => e.getAttribute('src')).sort());
  assert.deepEqual(insightScripts, ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'], `analytics scripts present: ${insightScripts}`);
  const lead = await page.evaluate(() => {
    const card = document.querySelector('.storefront .market-product');
    const range = document.createRange();
    range.setStart(document.querySelector('.storefront'), 0);
    range.setEndBefore(card);
    return { top: Math.round(card.getBoundingClientRect().top), words: range.toString().split(/\s+/).filter(Boolean).length,
      titles: [...document.querySelectorAll('.storefront .market-product h3')].map(h => h.innerText) };
  });
  assert.ok(lead.top < 700, `First product starts too low (${lead.top}px)`);
  assert.ok(lead.words < 80, `Too much text before the first product (${lead.words} words)`);
  assert.equal(new Set(lead.titles).size, lead.titles.length, `A product repeats on the home page: ${lead.titles}`);
  // Cards show the small copy, not the full-size upload.
  const cardSources = await page.locator('.storefront .market-product img').evaluateAll(els => els.map(e => e.getAttribute('src')));
  assert.ok(cardSources.length > 0 && cardSources.every(src => src.endsWith('/qa-bench-small.webp')), `cards use the thumbnail: ${cardSources}`);
  // Home cards are compact: no review line or cart controls (those live on the catalogue page).
  assert.equal(await page.locator('.storefront .market-product .market-product-reviews').count(), 0);
  assert.equal(await page.locator('.storefront .market-product .market-cart-button').count(), 0);
  // Full catalogue cards keep their detail.
  await page.goto(`${base}/marketplace`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  assert.equal(await page.locator('.market-product-reviews').first().innerText(), '4.5\n2 reviews\nPrintability passed');
  assert.equal(await page.getByRole('button', { name: 'Follow', exact: true }).count(), 0);
  assert.equal(await page.locator('.market-product a button').count(), 0);
  assert.equal(await page.locator('.market-product').first().getByRole('link', { name: 'View product', exact: true }).getAttribute('href'), '/marketplace/9001');
  assert.equal(await page.locator('.market-product').first().getByRole('link', { name: 'Choose options', exact: true }).getAttribute('href'), '/marketplace/9001');
  assert.equal(await page.locator('.market-product').first().getByRole('button', { name: 'Add Sample bench to cart', exact: true }).count(), 0);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  // The storefront speaks to buyers: no creator/partner promotion outside one quiet footer link.
  assert.equal(await page.getByRole('heading', { name: 'Make or print designs?' }).count(), 0);
  const footer = page.locator('footer');
  const footerText = await footer.innerText();
  assert.ok(!/For Creators|For Print Partners|Become a Creator|Partner Console/i.test(footerText), `Footer still promotes the supply side: ${footerText}`);
  assert.equal(await footer.getByRole('heading', { name: 'Shop', exact: true }).count(), 1);
  assert.equal(await footer.getByRole('link', { name: 'Sell on buy&sell3d', exact: true }).getAttribute('href'), '/sell');
  await page.getByRole('button', { name: 'Account and portals', exact: true }).click();
  await visible(page.getByRole('menuitem', { name: 'My Orders' }));
  assert.equal(await page.getByRole('menuitem', { name: 'Sell with buy&sell3d' }).count(), 0);
  await page.keyboard.press('Escape');
  checks.push('Customer storefront: no seller section on home, no creator/partner footer columns, one footer "Sell on buy&sell3d" link, no "Sell with buy&sell3d" in the customer account menu.');
  await page.locator('.home-tiles').getByRole('link', { name: /Digital models/ }).click();
  await page.waitForURL('**/marketplace?format=digital');
  await visible(page.getByRole('heading', { name: 'Digital models', exact: true }));
  const add = page.getByRole('button', { name: 'Add Sample bench to cart', exact: true });
  await add.click();
  await visible(page.locator('.market-cart-message').filter({ hasText: 'Added to cart.' }).first());
  assert.deepEqual(current.posts, [{ product_id: 9001, quantity: 1, selected_config: { purchase_type: 'digital' } }]);
  assert.equal(current.catalogueRequests.at(-1).format, 'digital');
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  await add.click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Add Sample bench to cart"]').disabled);
  assert.equal(current.posts.length, 2);
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  checks.push('Products-first home with two format tiles; generic cards require options; digital catalogue sends explicit purchase_type; duplicate additions preserve unique-item cart count.');

  for (const [width, height] of [[320,812], [375,812], [768,1024], [1280,800], [1440,900], [1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const metrics = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth,
      tileTop: document.querySelector('.home-tiles').getBoundingClientRect().top,
      card: document.querySelector('.storefront .market-product').getBoundingClientRect().top,
      h1: document.querySelector('h1').getBoundingClientRect().bottom,
      font: getComputedStyle(document.querySelector('h1')).fontFamily,
      // Self-hosted brand faces: the heading's first family is a loaded local font file.
      brandLoaded: [...document.fonts].some(f => f.status === 'loaded' && getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0].replace(/["']/g, '').trim() === f.family.replace(/["']/g, '')) }));
    assert.ok(metrics.page <= width, `Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.tileTop >= 64 && metrics.h1 < height, `Home heading or tiles off screen at ${width}`);
    assert.ok(metrics.card < height, `First product is not on the first screen at ${width}x${height}: ${metrics.card}px`);
    // Rows fill the width: the first row is one full line (no orphan card), and Trending reaches the right edge.
    const rows = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('.store-grid--compact .market-product')].filter(c => getComputedStyle(c).display !== 'none').map(c => Math.round(c.getBoundingClientRect().top));
      const rail = [...document.querySelectorAll('.store-rail--compact .market-product')].map(c => c.getBoundingClientRect()).filter(r => r.left < innerWidth);
      const container = document.querySelector('.store-rail--compact').getBoundingClientRect();
      return { lines: new Set(tops).size, count: tops.length, railVisible: rail.filter(r => r.right <= container.right + 1).length, railRight: Math.round(Math.max(...rail.map(r => Math.min(r.right, container.right)))), containerRight: Math.round(container.right) };
    });
    if (width > 768) assert.equal(rows.lines, 1, `First row wraps to ${rows.lines} lines at ${width}px (${rows.count} cards)`);
    assert.ok(rows.railRight >= rows.containerRight - 24, `Trending stops short of the right edge at ${width}px: ${JSON.stringify(rows)}`);
    assert.match(metrics.font, /space_?grotesk|space grotesk/i);
    assert.ok(metrics.brandLoaded, `brand display font not loaded: ${metrics.font}`);
    await page.screenshot({path:`${out}/fixture-home-${width}.png`, fullPage: width === 375 || width === 1440});
  }
  checks.push('320/375/768/1280/1440/1920px: no page overflow; heading, format tiles and the first product on the first screen; brand font loaded.');

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

  {
    // Day/night switch: starts from the system scheme, flips the class, survives a reload.
    const t = await visit({ colorScheme: 'light' });
    const toggle = t.page.locator('[data-flow="theme"]');
    await visible(toggle);
    assert.equal(await toggle.getAttribute('data-state'), 'day');
    assert.equal(await t.page.getByRole('switch', { name: 'Night mode' }).getAttribute('aria-checked'), 'false');
    const box = await toggle.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `theme switch target ${box.width}x${box.height}`);
    await toggle.click();
    await t.page.locator('html.dark').waitFor();
    assert.equal(await toggle.getAttribute('data-state'), 'night');
    assert.equal(await toggle.getAttribute('aria-checked'), 'true');
    await t.page.reload();
    await t.page.locator('html.dark').waitFor();
    await t.page.locator('[data-flow="theme"][data-state="night"]').waitFor();
    await t.page.locator('[data-flow="theme"]').click();
    await t.page.locator('html:not(.dark)').waitFor();
    assert.equal(await t.page.locator('[data-flow="theme"]').getAttribute('data-state'), 'day');
    checks.push('Day/night switch: starts from the system scheme, toggles the dark class, persists across reload, 44px target.');
    await t.context.close();
  }

  for (const scheme of ['light', 'dark']) {
    const v = await visit({ colorScheme: scheme });
    await visible(v.page.getByRole('link', { name: 'View Sample bench', exact: true }));
    await v.page.evaluate(() => document.fonts.ready);
    await settleImages(v.page);
    const pair = await v.page.locator('.home-tile--printed').evaluate(el => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    const ratio = contrast(pair.color, pair.bg);
    assert.ok(ratio >= 4.5, `${scheme} primary contrast ${ratio}`);
    await v.page.keyboard.press('Tab');
    const focus = await v.page.evaluate(() => ({ width: getComputedStyle(document.activeElement).outlineWidth, style: getComputedStyle(document.activeElement).outlineStyle }));
    assert.notEqual(focus.width, '0px');
    assert.notEqual(focus.style, 'none');
    await settleImages(v.page);
    await v.page.locator('.storefront .market-product-image img').first().screenshot({path:`${out}/fixture-${scheme}-product.png`});
    await v.page.screenshot({path:`${out}/fixture-${scheme}.png`});
    checks.push(`${scheme}: primary text contrast ${ratio.toFixed(2)}:1; keyboard focus visible.`);
    await v.context.close();
  }

  {
    // A selected field highlights its own edge: no second ring or box floating behind it.
    const f = await visit();
    await visible(f.page.getByRole('link', { name: 'View Sample bench', exact: true }));
    const pill = f.page.locator('.search-pill');
    const resting = await pill.evaluate(el => getComputedStyle(el).borderTopColor);
    for (const field of [f.page.getByRole('searchbox', { name: 'Search buy&sell3d' }), f.page.getByRole('combobox', { name: 'Search category' })]) {
      await field.click();
      const style = await field.evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow }));
      assert.deepEqual(style, { outline: 'none', shadow: 'none' }, 'no inner ring on a field inside the search pill');
      // The pill itself shows the focus. Even a near-instant transition lands a frame later, so wait for it.
      await f.page.waitForFunction(before => getComputedStyle(document.querySelector('.search-pill')).borderTopColor !== before, resting, { timeout: 5000 });
      await f.page.keyboard.press('Escape');
    }
    await f.context.close();
    checks.push('Search and category fields show focus on the pill edge only, with no second ring.');
  }

  // Phones: every header control stays on screen, signed in or out.
  for (const authenticated of [false, true]) {
    const h = await visit({ authenticated, viewport: { width: 320, height: 700 } });
    await visible(h.page.getByRole('button', { name: 'Open menu', exact: true }));
    for (const width of [320, 360, 390]) {
      await h.page.setViewportSize({ width, height: 700 });
      const right = await h.page.evaluate(() => Math.max(...[...document.querySelectorAll('nav.site-header a, nav.site-header button')]
        .map(el => el.getBoundingClientRect()).filter(box => box.width > 0).map(box => box.right)));
      assert.ok(right <= width, `Header runs off screen at ${width}px (authenticated: ${authenticated}): ${right}px`);
    }
    await h.context.close();
  }
  checks.push('Phone header: name, cart, account and menu stay on screen at 320, 360 and 390px, signed in or out.');

  const loading = await visit({ state: 'loading' });
  await visible(loading.page.getByRole('status').filter({ hasText: 'Loading the catalogue' }));
  await loading.page.screenshot({path:`${out}/loading.png`});
  loading.current.state = 'empty'; loading.current.release?.();
  await visible(loading.page.getByRole('heading', { name: 'No models yet.' }));
  assert.equal(await loading.page.locator('.market-product').count(), 0);
  await loading.page.screenshot({path:`${out}/empty.png`});
  await loading.context.close();
  checks.push('Loading announces its state; empty catalogue offers browse action without empty product headings.');

  const failure = await visit({ state: 'error' });
  await visible(failure.page.getByRole('heading', { name: 'The catalogue couldn’t load.' }));
  assert.ok(failure.current.homepageRequests >= 2);
  await failure.page.screenshot({path:`${out}/error.png`});
  failure.current.state = 'full';
  await failure.page.getByRole('button', { name: 'Try again', exact: true }).click();
  await visible(failure.page.getByRole('link', { name: 'View Sample bench', exact: true }));
  await failure.context.close();
  checks.push('API outage produces a retry action; retry recovers the catalogue.');

  // Audience popup: no card on the page; opens on request; saves every step; the contact step needs an email and consent.
  const signup = await visit();
  await visible(signup.page.getByRole('link', { name: 'View Sample bench', exact: true }));
  assert.equal(await signup.page.locator('[data-flow="waitlist"]').count(), 0, 'The waitlist card is gone from the home page');
  assert.equal(await signup.page.locator('[data-flow="audience"]').count(), 0, 'The popup does not open straight away');
  await signup.page.getByRole('button', { name: 'Tell us what you’d like us to make' }).click();
  const popup = signup.page.locator('[data-flow="audience"][data-state="open"]');
  await visible(popup);
  assert.equal(await popup.getAttribute('data-step'), '1');
  await popup.getByRole('radio', { name: 'Parent or family' }).check();
  await popup.getByLabel(/Your city/).fill('  Pune ');
  await popup.getByRole('button', { name: 'Next' }).click();
  await popup.getByRole('checkbox', { name: 'Gifts for someone' }).check();
  await popup.getByRole('checkbox', { name: 'Birthdays' }).check();
  await popup.getByRole('group', { name: /3D printer/ }).getByRole('radio', { name: 'No' }).check();
  await popup.getByRole('group', { name: /personalised/ }).getByRole('radio', { name: 'Sometimes' }).check();
  await popup.getByRole('checkbox', { name: 'Hobby: tabletop, minis, cosplay' }).check();
  assert.ok(await popup.getByRole('checkbox', { name: 'Decorate my home or room' }).isDisabled(), 'A third use cannot be picked');
  await popup.getByRole('checkbox', { name: 'Hobby: tabletop, minis, cosplay' }).uncheck();
  await popup.getByRole('button', { name: 'Next' }).click();
  await popup.getByRole('group', { name: /where was it from/ }).getByRole('radio', { name: 'A local shop' }).check();
  await popup.getByRole('group', { name: /how much/ }).getByRole('radio', { name: '₹500–1,500' }).check();
  await popup.getByLabel(/missing or annoying/).fill('  Nothing   local  ');
  await popup.screenshot({ path: `${out}/audience-step3.png` });
  await popup.getByRole('button', { name: 'Next' }).click();
  assert.equal(await popup.getAttribute('data-step'), '4');
  assert.equal(signup.current.audience.length, 3, 'Steps 1-3 each save when Next is pressed');
  assert.deepEqual(signup.current.audience[2], {
    response_id: signup.current.audience[0].response_id, anon_id: signup.current.audience[0].anon_id, step: 3, role: 'parent', city: 'Pune', uses: ['gifts'],
    occasions: ['birthday'], owns_printer: 'no', personalise: 'sometimes', bought_where: 'local_shop', spend_band: '500_1500', missing: 'Nothing local',
  });
  await popup.getByRole('button', { name: 'Notify me' }).click();
  for (const text of ['Enter your email address.', 'Tick the box so we can contact you.']) await visible(popup.getByText(text));
  assert.equal(signup.current.audience.length, 3, 'Nothing is sent until the contact step is valid');
  await popup.getByRole('textbox', { name: /^Email/ }).fill(' QA@Example.test ');
  await popup.getByRole('checkbox', { name: /Contact me about buy&sell3d/ }).check();
  await popup.screenshot({ path: `${out}/audience-contact.png` });
  await popup.getByRole('button', { name: 'Notify me' }).click();
  await signup.page.locator('[data-flow="audience"][data-state="done"]').waitFor();
  await visible(signup.page.getByText('Thank you. You’re on the list.'));
  assert.deepEqual(signup.current.audience[3], { response_id: signup.current.audience[0].response_id, anon_id: signup.current.audience[0].anon_id, step: 4,
    role: 'parent', city: 'Pune', uses: ['gifts'], occasions: ['birthday'], owns_printer: 'no', personalise: 'sometimes', bought_where: 'local_shop',
    spend_band: '500_1500', missing: 'Nothing local', email: 'qa@example.test', chat_ok: false, consent: true });
  await signup.page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await signup.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Popup must not overflow at 375px');
  await signup.page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await signup.page.locator('[data-flow="audience"]').waitFor({ state: 'detached' });
  await signup.context.close();
  const open = await visit({ state: 'printed' });
  await visible(open.page.getByRole('link', { name: 'View Sample bench', exact: true }));
  assert.equal(await open.page.getByRole('button', { name: 'Tell us what you’d like us to make' }).count(), 0);
  assert.match(await open.page.locator('.home-tile--printed').innerText(), /Delivered in India/);
  await open.context.close();
  checks.push('Audience popup: no card on the home page; opens on request; saves each step with the visitor id; contact step needs email and consent; no overflow at 375px; the request button is hidden once printing is open.');

  // Motion welcome: nothing waits to appear, and pointing at a card lifts its printed block.
  const motion = await visit({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 640 } });
  await visible(motion.page.getByRole('link', { name: 'View Sample bench', exact: true }));
  assert.equal(await motion.page.locator('[data-reveal]').count(), 0);
  const block = motion.page.locator('.market-product-image').first();
  const rest = await block.evaluate(el => getComputedStyle(el).boxShadow);
  assert.notEqual(rest, 'none', 'cards stand on printed layers');
  await block.hover();
  await motion.page.waitForFunction(before => getComputedStyle(document.querySelector('.market-product-image')).boxShadow !== before, rest);
  await motion.context.close();
  assert.deepEqual(motion.errors, []);
  checks.push('Cards stand on printed layers that lift on hover; nothing is hidden waiting to appear.');

  writeFileSync(`${out}/results.json`, JSON.stringify({ base, checks, passed: checks.length, fixtureBrowserBypassesCSP: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
