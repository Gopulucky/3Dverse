/** Public support page checks. Never visits a provider or transfers money. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const expectedUrl = process.argv[3] || '';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext();
try {
  // Catalogue/nav requests are fixtures; the support page itself is real SSR.
  await context.route('**/api/**', route => route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }));
  const page = await context.newPage();
  await page.goto(`${base}/support?success=true&payment_status=paid`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Support 3DVerse', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Support 3DVerse', exact: true }).getAttribute('href'), '/support');
  assert.equal(await page.getByRole('link', { name: 'Keep exploring the marketplace' }).getAttribute('href'), '/marketplace');
  assert.match(await page.locator('main').innerText(), /voluntary, one-time contribution/i);
  assert.doesNotMatch(await page.locator('main').innerText(), /payment successful|thank you for (your )?(payment|contribution)/i);
  const action = page.getByRole('link', { name: 'Make a contribution', exact: true });
  if (expectedUrl) {
    assert.equal(await action.getAttribute('href'), expectedUrl);
    assert.equal(await action.getAttribute('target'), '_blank');
    assert.match(await action.getAttribute('rel'), /noopener/);
    for (let tab = 0; tab < 40; tab++) {
      await page.keyboard.press('Tab');
      if (await action.evaluate(el => el === document.activeElement)) break;
    }
    assert.equal(await action.evaluate(el => el === document.activeElement), true, 'Contribution action must be reachable by keyboard');
    assert.equal(await action.evaluate(el => el.matches(':focus-visible')), true);
    assert.notEqual(await action.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.getByRole('status').filter({ hasText: 'Contributions aren’t available yet' }).count(), 0);
  } else {
    assert.equal(await action.count(), 0);
    await page.getByRole('status').filter({ hasText: 'Contributions aren’t available yet' }).waitFor();
  }
  assert.match(await page.getByRole('link', { name: 'Contact the 3DVerse team' }).getAttribute('href'), /^mailto:/);
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
  await mkdir('.hallmark/verification', { recursive: true });
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `.hallmark/verification/support-${expectedUrl ? 'configured' : 'unavailable'}-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({ path: `.hallmark/verification/support-${expectedUrl ? 'configured' : 'unavailable'}-dark.png`, fullPage: true });
  console.log(`PASS support ${expectedUrl ? 'configured' : 'unavailable'}: guest access, destination, forged return, focus and responsive layout`);
} finally {
  await context.close();
  await browser.close();
}
