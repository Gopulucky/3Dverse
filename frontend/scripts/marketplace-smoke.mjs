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
  creator_id: 7, creator_name: 'QA catalogue', avg_rating: 4.5, review_count: 2,
  is_mode_2_active: true, is_featured: true,
  media: [{ media_url: '/qa-bench.jpg', thumb_url: '/qa-bench-small.webp', is_primary: true }],
  versions: [{ is_latest: true, file_format: 'STL', printability_report: { status: 'pass', volume_mm3: 40700 } }],
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
      return send(current.productCount ? products.slice(0, current.productCount) : products);
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
  // The drawn wordmark in header and footer: ink letters, amber "&" and "3d", read as the name.
  const marks = await page.evaluate(() => [...document.querySelectorAll('nav.site-header .wordmark, footer .wordmark')].map(mark => {
    const art = mark.querySelector('svg');
    return [mark.closest('footer') ? 'footer' : 'header', mark.textContent, ...[...art.querySelectorAll('path')].map(path => getComputedStyle(path).fill), art.getBoundingClientRect().height >= 20];
  }));
  assert.deepEqual(marks, ['header', 'footer'].map(place => [place, 'buy&sell3d', 'rgb(18, 22, 25)', 'rgb(232, 106, 23)', true]));
  assert.equal(await page.locator('nav.site-header').getByRole('link', { name: 'buy&sell3d', exact: true }).count(), 1);
  // The short mark is the browser-tab and home-screen icon.
  for (const rel of ['icon', 'apple-touch-icon']) {
    const href = await page.locator(`head link[rel="${rel}"][href*="icon"]`).last().getAttribute('href');
    const icon = await page.request.get(new URL(href, base).href);
    assert.equal(icon.headers()['content-type'], 'image/png', `${rel} is served`);
  }
  // Vercel Web Analytics and Speed Insights: same-origin scripts, loaded once and deferred (they 404 off Vercel, harmlessly).
  const insightScripts = await page.locator('script[src^="/_vercel/"]').evaluateAll(els => els.map(e => e.getAttribute('src')).sort());
  assert.deepEqual(insightScripts, ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'], `analytics scripts present: ${insightScripts}`);
  // The owner's brand photograph stands beside the headline; the cards start from the newest.
  const photo = page.locator('.home-hero-photo img');
  assert.match(await photo.getAttribute('alt'), /Ideas you can hold/);
  assert.ok(await photo.evaluate(img => img.decode().then(() => img.naturalWidth > 0)), 'hero photograph loads');
  assert.ok(Math.abs(await photo.evaluate(img => img.clientWidth / img.clientHeight) - 1600 / 990) < 0.02, 'the photograph is shown whole');
  assert.equal(await page.locator('.home-showcase').count(), 0);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.home-grid h3')].filter(h => h.getClientRects().length).map(h => h.innerText));
  assert.deepEqual(shown, ['Sample bench', 'Sample model 2', 'Sample model 3', 'Sample model 4']);
  const lead = await page.evaluate(() => {
    const card = document.querySelector('.storefront .market-product');
    const range = document.createRange();
    range.setStart(document.querySelector('.storefront'), 0);
    range.setEndBefore(card);
    return { top: Math.round(card.getBoundingClientRect().top), words: range.toString().split(/\s+/).filter(Boolean).length,
      titles: [...document.querySelectorAll('.storefront h3')].filter(h => h.getClientRects().length).map(h => h.innerText) };
  });
  // With the photograph in the hero, the cards still begin on the first screen (900px tall here).
  assert.ok(lead.top < 820, `First product starts too low (${lead.top}px)`);
  assert.ok(lead.words < 80, `Too much text before the first product (${lead.words} words)`);
  assert.equal(new Set(lead.titles).size, lead.titles.length, `A product repeats on the home page: ${lead.titles}`);
  // Cards show the small copy, not the full-size upload.
  const cardSources = await page.locator('.storefront .market-product img').evaluateAll(els => els.map(e => e.getAttribute('src')));
  assert.ok(cardSources.length > 0 && cardSources.every(src => src.endsWith('/qa-bench-small.webp')), `cards use the thumbnail: ${cardSources}`);
  // One kind of card everywhere; the home page adds no review line or cart control.
  assert.equal(await page.locator('.storefront .market-product--compact').count(), 0);
  assert.ok(await page.locator('.storefront .market-product--card').count() > 0);
  // The rail is driven by its arrows, and the trust strip's rule lines up with the grid.
  assert.equal(await page.locator('.home-rail').evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
  assert.deepEqual(await page.locator('.home-trust').evaluate(el => [getComputedStyle(el).borderTopWidth, getComputedStyle(el.querySelector('ul')).borderTopWidth]), ['0px', '1px']);
  // The header stays solid once the page has moved, so nothing shows through under the name.
  await page.evaluate(() => scrollTo(0, 420));
  await page.locator('nav.site-header[data-scrolled="true"]').waitFor();
  assert.equal(await page.locator('nav.site-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(await page.locator('.storefront .market-product .market-product-reviews').count(), 0);
  assert.equal(await page.locator('.storefront .market-product .market-cart-button').count(), 0);
  // Day/night sits in the header; a signed-in shopper's country sits in the account menu.
  const header = page.locator('nav.site-header');
  assert.equal(await header.getByRole('combobox').count(), 0, 'no category picker in the header');
  assert.equal(await header.getByRole('link', { name: 'Orders', exact: true }).count(), 0);
  assert.equal(await header.locator('[data-flow="theme"]').count(), 1);
  assert.equal(await header.getByRole('button', { name: /Country and currency/ }).count(), 0);
  assert.equal(await page.locator('footer [data-flow="theme"]').count(), 0);
  assert.equal(await page.locator('footer').getByRole('button', { name: /Country and currency/ }).count(), 0, 'signed in: not repeated in the footer');
  await page.getByRole('button', { name: 'Account and portals', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Country and currency: India, INR' }).click();
  const region = page.getByRole('dialog', { name: 'Where are you shopping from?' });
  await visible(region);
  await region.getByLabel('Country', { exact: true }).selectOption('AU');
  await page.keyboard.press('Escape');
  await region.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Account and portals', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Country and currency: Australia, AUD' }).click();
  await region.getByLabel('Country', { exact: true }).selectOption('IN');
  await page.keyboard.press('Escape');
  await region.waitFor({ state: 'hidden' });
  // Catalogue cards: badge, category, name, creator, one price and one action.
  await page.goto(`${base}/marketplace`, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  const card = page.locator('.market-product').first();
  assert.deepEqual(await card.locator('.market-product-badge').allInnerTexts(), ['Digital', 'Printed']);
  // Warm paper behind white cards; each format keeps its own colours.
  const paint = (selector) => page.locator(selector).first().evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  assert.equal((await paint('body'))[0], 'rgb(248, 247, 244)', 'warm alabaster page');
  assert.equal((await paint('nav.site-header'))[0], 'rgb(255, 255, 255)', 'white header');
  assert.equal((await paint('.market-product--card'))[0], 'rgb(255, 255, 255)', 'white card');
  assert.equal((await paint('.market-product-image'))[0], 'rgb(236, 238, 242)', 'soft slate stage');
  assert.deepEqual(await paint('.market-product-badge--digital'), ['rgb(230, 240, 241)', 'rgb(11, 79, 86)']);
  assert.deepEqual(await paint('.market-product-badge--physical'), ['rgb(11, 79, 86)', 'rgb(255, 255, 255)']);
  assert.equal(await card.locator('.market-product-category').textContent(), 'Home Decor');
  assert.match(await card.locator('.market-product-price').innerText(), /From\s*₹120(?![\d.])/);
  assert.equal(await card.getByRole('link', { name: 'QA catalogue', exact: true }).getAttribute('href'), '/creators/7');
  assert.equal(await card.getByRole('link', { name: 'View product', exact: true }).getAttribute('href'), '/marketplace/9001');
  assert.equal(await card.getByRole('button', { name: 'Save Sample bench to wishlist', exact: true }).count(), 1);
  assert.equal(await card.getByRole('button', { name: /to cart/ }).count(), 0, 'one action per card');
  assert.equal(await card.locator('.market-product-reviews, .market-product-modes').count(), 0, 'no extra metadata');
  assert.equal(await card.locator('.market-product-featured').count(), 1, 'a featured listing carries its one tag');
  assert.equal(await page.getByText('Printability passed').count(), 0, 'cards carry no repeated badge');
  assert.equal(await page.getByRole('button', { name: 'Follow', exact: true }).count(), 0);
  assert.equal(await page.locator('.market-product a button').count(), 0);
  const media = await card.locator('.market-product-image').evaluate(el => ({ ratio: el.clientWidth / el.clientHeight, fit: getComputedStyle(el.querySelector('img')).objectFit }));
  assert.ok(Math.abs(media.ratio - 4 / 3) < 0.03, `card picture is not 4:3 (${media.ratio})`);
  assert.equal(media.fit, 'contain', 'renders are never cropped');
  assert.equal(await card.locator('.market-product-image img').evaluate(el => getComputedStyle(el).padding), '0px', 'the picture runs to the card edges');
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
  await visible(page.locator('.market-product-badge').first().filter({ hasText: /^Digital model$/ }));
  assert.match(await page.locator('.market-product-price').first().innerText(), /^₹120(?![\d.])/);
  assert.equal(current.catalogueRequests.at(-1).format, 'digital');
  await page.locator('.market-product').first().getByRole('link', { name: 'View product', exact: true }).click();
  await page.waitForURL('**/marketplace/9001**');
  await page.getByRole('radio', { name: /Digital model file/ }).check();
  const add = page.getByRole('button', { name: 'Add to cart', exact: true });
  await add.click();
  await visible(page.getByRole('status').filter({ hasText: 'Added to cart.' }));
  assert.deepEqual(current.posts, [{ product_id: 9001, quantity: 1, selected_config: { purchase_type: 'digital' } }]);
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  await add.click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-flow="buy-box"] button')].some(b => b.textContent.trim() === 'Add to cart' && !b.disabled));
  assert.equal(current.posts.length, 2);
  await visible(page.getByRole('link', { name: 'Cart, 1 item', exact: true }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await visible(page.getByRole('link', { name: 'View Sample bench', exact: true }));
  checks.push('Products-first home with two format tiles; cards lead to the product page; digital catalogue sends explicit purchase_type; duplicate additions preserve unique-item cart count.');

  for (const [width, height] of [[320,812], [375,812], [768,1024], [1280,800], [1440,900], [1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const metrics = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth,
      tileTop: document.querySelector('.home-tiles').getBoundingClientRect().top,
      card: [...document.querySelectorAll('.storefront .market-product')].find(el => el.getClientRects().length).getBoundingClientRect().top,
      h1: document.querySelector('h1').getBoundingClientRect().bottom,
      font: getComputedStyle(document.querySelector('h1')).fontFamily,
      // Self-hosted brand faces: the heading's first family is a loaded local font file.
      brandLoaded: [...document.fonts].some(f => f.status === 'loaded' && getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0].replace(/["']/g, '').trim() === f.family.replace(/["']/g, '')) }));
    assert.ok(metrics.page <= width, `Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.tileTop >= 64 && metrics.h1 < height, `Home heading or tiles off screen at ${width}`);
    assert.ok(metrics.card < height, `First product is not on the first screen at ${width}x${height}: ${metrics.card}px`);
    // Rows fill the width: the first row is one full line (no orphan card), and Trending reaches the right edge.
    const rows = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('.home-grid .market-product')].filter(c => getComputedStyle(c).display !== 'none').map(c => Math.round(c.getBoundingClientRect().top));
      const rail = [...document.querySelectorAll('.home-rail .market-product')].map(c => c.getBoundingClientRect()).filter(r => r.left < innerWidth);
      const container = document.querySelector('.home-rail').getBoundingClientRect();
      return { lines: new Set(tops).size, count: tops.length, railVisible: rail.filter(r => r.right <= container.right + 1).length, railRight: Math.round(Math.max(...rail.map(r => Math.min(r.right, container.right)))), containerRight: Math.round(container.right) };
    });
    if (width > 768) assert.equal(rows.lines, 1, `First row wraps to ${rows.lines} lines at ${width}px (${rows.count} cards)`);
    assert.ok(rows.railRight >= rows.containerRight - 24, `Trending stops short of the right edge at ${width}px: ${JSON.stringify(rows)}`);
    assert.ok(await page.locator('.home-hero-photo img').isVisible(), `hero photograph is shown at ${width}px`);
    // The hero keeps its hierarchy: a display headline, a spaced sentence and compact buttons,
    // leading with what can be bought today.
    const type = await page.evaluate(() => ({ h1: parseFloat(getComputedStyle(document.querySelector('.home-hero h1')).fontSize),
      gap: parseFloat(getComputedStyle(document.querySelector('.home-hero-lead')).marginTop),
      tiles: [...document.querySelectorAll('.home-hero .home-tile')].map(t => [t.querySelector('strong').innerText, t.offsetHeight]) }));
    assert.ok(type.h1 >= 36 && (width < 1024 || type.h1 >= 56), `headline is only ${type.h1}px at ${width}px`);
    assert.ok(type.gap >= 12, `sentence sits against the headline at ${width}px`);
    assert.deepEqual(type.tiles.map(t => t[0]), ['Digital models', 'Printed products']);
    assert.ok(type.tiles.every(t => t[1] <= 96), `format buttons are too tall at ${width}px: ${JSON.stringify(type.tiles)}`);
    // Linux renders the same fonts a few percent wider than Windows. Each name must still sit on
    // one line with that to spare, or the buttons grow a line on some machines only.
    const widened = await page.addStyleTag({ content: '.home-hero .home-tile { letter-spacing: 0.03em; }' });
    const lines = await page.locator('.home-hero .home-tile strong').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))));
    assert.deepEqual(lines, [1, 1], `a format name wraps at ${width}px with slightly wider text`);
    await widened.evaluate(el => el.remove());
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
    // Signed out there is no account menu, so country stays in the footer.
    assert.equal(await t.page.locator('nav.site-header [data-flow="theme"]').count(), 1);
    assert.equal(await t.page.locator('footer').getByRole('button', { name: /Country and currency/ }).count(), 1);
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
    await v.page.locator('.storefront .market-product-image img >> visible=true').first().screenshot({path:`${out}/fixture-${scheme}-product.png`});
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
    for (const field of [f.page.getByRole('searchbox', { name: 'Search buy&sell3d' })]) {
      await field.click();
      const style = await field.evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow }));
      assert.deepEqual(style, { outline: 'none', shadow: 'none' }, 'no inner ring on a field inside the search pill');
      // The pill itself shows the focus. Even a near-instant transition lands a frame later, so wait for it.
      await f.page.waitForFunction(before => getComputedStyle(document.querySelector('.search-pill')).borderTopColor !== before, resting, { timeout: 5000 });
      await f.page.keyboard.press('Escape');
    }
    await f.context.close();
    checks.push('The search field shows focus on the pill edge only, with no second ring.');
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
  {
    // The narrowest phones have no room for the switch in the header, so the menu holds it.
    const n = await visit({ viewport: { width: 320, height: 700 } });
    await visible(n.page.getByRole('button', { name: 'Open menu', exact: true }));
    assert.equal(await n.page.locator('nav.site-header [data-flow="theme"]').isVisible(), false);
    await n.page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await visible(n.page.locator('#mobile-navigation [data-flow="theme"]'));
    await n.page.keyboard.press('Escape');
    await n.page.setViewportSize({ width: 390, height: 700 });
    await visible(n.page.locator('nav.site-header [data-flow="theme"]'));
    await n.page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await visible(n.page.getByRole('navigation', { name: 'Mobile navigation' }));
    assert.equal(await n.page.locator('#mobile-navigation [data-flow="theme"]').isVisible(), false, 'one switch at a time');
    // Tab from the last thing on show wraps round inside the menu.
    await n.page.locator('#mobile-navigation a').last().focus();
    await n.page.keyboard.press('Tab');
    assert.equal(await n.page.evaluate(() => document.activeElement?.id), 'mobile-menu-toggle');
    await n.context.close();
  }
  checks.push('Phone header: name, cart, account and menu stay on screen at 320, 360 and 390px, signed in or out.');

  {
    // One page of results: a count, no pager. Phones: one search box on the catalogue.
    const one = await visit({ viewport: { width: 375, height: 812 } });
    one.current.productCount = 3;
    await one.page.goto(`${base}/marketplace`, { waitUntil: 'domcontentloaded' });
    await visible(one.page.getByRole('status').filter({ hasText: '3 products' }));
    assert.equal(await one.page.getByRole('navigation', { name: 'Catalogue pages' }).count(), 0);
    await visible(one.page.getByRole('searchbox', { name: 'Search catalogue' }));
    await one.page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await visible(one.page.getByRole('navigation', { name: 'Mobile navigation' }));
    assert.equal(await one.page.getByRole('searchbox', { name: 'Search models' }).count(), 0, 'the menu does not repeat the page search');
    await one.context.close();
    checks.push('A single page of results shows a count and no pager; the phone catalogue has one search box.');
  }

  {
    // One wide container shared by header, page and footer; 4, 3 then 2 columns.
    const l = await visit();
    await l.page.goto(`${base}/marketplace`, { waitUntil: 'domcontentloaded' });
    await visible(l.page.getByRole('link', { name: 'View Sample bench', exact: true }));
    for (const [width, columns] of [[1920, 4], [1440, 4], [1280, 4], [1024, 4], [768, 3], [375, 2], [320, 2]]) {
      await l.page.setViewportSize({ width, height: 900 });
      await l.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await l.page.evaluate(() => {
        const content = (selector) => { const el = document.querySelector(selector), s = getComputedStyle(el), r = el.getBoundingClientRect(); return [Math.round(r.left + parseFloat(s.paddingLeft)), Math.round(r.right - parseFloat(s.paddingRight))]; };
        const cards = [...document.querySelectorAll('.catalogue-grid .market-product')];
        return { columns: cards.filter(c => c.offsetTop === cards[0].offsetTop).length, view: document.documentElement.clientWidth,
          edges: ['nav.site-header .store-container', 'main .store-container', 'footer .store-container'].map(content),
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      assert.equal(layout.columns, columns, `${layout.columns} columns at ${width}px`);
      assert.ok(layout.overflow <= 0, `sideways scroll at ${width}px`);
      assert.equal(new Set(layout.edges.map(String)).size, 1, `header, page and footer do not line up at ${width}px: ${JSON.stringify(layout.edges)}`);
      const [left, right] = layout.edges[0];
      if (width === 1280 || width === 1440) assert.ok((right - left) / layout.view >= 0.935, `content is only ${right - left}px of ${layout.view}`);
      if (width === 1920) assert.ok(Math.abs(right - left - 1600) <= 1, `content caps at 1600px, got ${right - left}`);
    }
    await l.context.close();
    checks.push('Catalogue: header, page and footer share one wide container (1600px cap); 4, 3 and 2 columns without sideways scroll.');
  }

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
  const block = motion.page.locator('.market-product--card >> visible=true').first();
  const rest = await block.evaluate(el => getComputedStyle(el).boxShadow);
  assert.notEqual(rest, 'none', 'cards stand on printed layers');
  await block.hover();
  const handle = await block.elementHandle();
  await motion.page.waitForFunction(([el, before]) => getComputedStyle(el).boxShadow !== before, [handle, rest]);
  await motion.context.close();
  assert.deepEqual(motion.errors, []);
  checks.push('Cards stand on printed layers that lift on hover; nothing is hidden waiting to appear.');

  writeFileSync(`${out}/results.json`, JSON.stringify({ base, checks, passed: checks.length, fixtureBrowserBypassesCSP: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
