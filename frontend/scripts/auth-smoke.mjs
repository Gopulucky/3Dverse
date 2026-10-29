import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true});
try {
  // API fixtures can use HTTP localhost alongside a production CSP. This
  // isolated context verifies UI/session behaviour, not deployed CSP/networking.
  const page = await browser.newPage({viewport:{width:375,height:812}, bypassCSP:true});
  const posts = [];
  let holdRefresh = false;
  let oldRefresh;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const second = route.request().postData()?.includes('buyer2') || route.request().headers().authorization === 'Bearer fixture-token-100';
    const user = {id:second ? 100 : 99,email:second ? 'buyer2@example.com' : 'buyer@example.com',role:'customer'};
    if (path.endsWith('/users/me') && !second && holdRefresh) { oldRefresh = route; return; }
    if (route.request().method() === 'POST') posts.push({path, body: route.request().postData()});
    const orders = [{id:second ? 8100 : 8099,status:'paid',total:100,currency:'INR',created_at:'2026-10-29T10:00:00',items:[]}];
    const json = path.endsWith('/login/access-token') ? {access_token:`fixture-token-${user.id}`,user} : path.endsWith('/users/me') ? user : /\/orders\/?$/.test(path) ? orders : [];
    await route.fulfill({json});
  });
  await page.goto(`${base}/login?next=%2F%5Cevil.example`, {waitUntil:'domcontentloaded'});
  await page.getByRole('heading', {name:'Sign in to 3DVerse',exact:true}).waitFor();
  await page.locator('form[data-ready="true"]').waitFor();
  assert.match(await page.locator('body').innerText(), /Track your orders and access your purchased 3D files/);
  await page.getByRole('link', {name:'Keep browsing without an account'}).waitFor();
  const google = page.getByRole('button', {name:'Continue with Google',exact:true});
  await google.waitFor();
  if (await google.isDisabled()) {
    await page.getByLabel('Email', {exact:true}).fill('buyer@example.com');
    await page.getByLabel('Password', {exact:true}).fill('old-password');
    await page.getByRole('button',{name:'Sign in with email',exact:true}).click();
    await page.waitForURL(`${base}/marketplace/home`);
    assert.match(posts[0].body, /username=buyer%40example.com/);
    holdRefresh = true;
    await page.goto(`${base}/orders`);
    await page.getByText('#8099', {exact:true}).waitFor();
    await page.getByRole('button',{name:'Account and portals'}).click();
    await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();
    await page.waitForURL(url => ['/', '/login'].includes(url.pathname));
    if (new URL(page.url()).pathname !== '/login') await page.getByRole('button',{name:'Sign in',exact:true}).first().click();
    await page.locator('form[data-ready="true"]').waitFor();
    await page.getByLabel('Email',{exact:true}).fill('buyer2@example.com');
    await page.getByLabel('Password',{exact:true}).fill('another-password');
    await page.getByRole('button',{name:'Sign in with email',exact:true}).click();
    await page.waitForURL(`${base}/marketplace/home`);
    await page.getByRole('button',{name:'Account and portals'}).click();
    await page.getByRole('menuitem',{name:'My Orders',exact:true}).click();
    await page.getByText('#8100',{exact:true}).waitFor();
    assert.equal(await page.getByText('#8099',{exact:true}).count(),0,'previous account data must be cleared on logout');
    assert.ok(oldRefresh, 'test must hold the earlier account refresh');
    const refreshed = page.waitForResponse(response => response.url().endsWith('/api/users/me'));
    await oldRefresh.fulfill({json:{id:99,email:'buyer@example.com',role:'customer'}});
    await refreshed;
    await page.getByRole('button',{name:'Account and portals'}).click();
    await page.getByText('buyer2@example.com',{exact:true}).waitFor();
    assert.equal(await page.getByText('buyer@example.com',{exact:true}).count(),0,'late refresh must not overwrite a newer session');
  }
  await page.goto(`${base}/register`);
  await page.getByRole('heading',{name:'Your 3DVerse account',exact:true}).waitFor();
  assert.equal(await page.getByRole('radio').count(),0,'customer sign-up has no role puzzle');
  await page.getByRole('link',{name:'Want to sell your designs?'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'mobile auth must fit');
  console.log('Auth fixtures passed: clear purpose, Google availability, customer signup, safe return path, account cache isolation, stale refresh guard and mobile width. Real Firebase requires project configuration.');
} finally { await browser.close(); }
