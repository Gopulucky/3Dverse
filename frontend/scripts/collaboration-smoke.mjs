/** Creator-side partner list fixture test; no real accounts or database. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge', headless:true});
const context = await browser.newContext({bypassCSP:true, viewport:{width:1280,height:900}});
const user = {id:7,email:'designer@example.test',role:'creator'};
const requests = [];
const partner = {id:1,name:'Maker Shop',region:'Bengaluru',cost_tier:null,bio:'We print quickly.',lead_time_days:5,price_per_gram_inr:4.5,min_order_inr:200,
  build_x_mm:220,build_y_mm:220,build_z_mm:250,total_orders_fulfilled:0,total_defect_reports:0,capabilities:[{technology:'fdm',material_type:'PLA'}]};
let partners = [partner];
await context.addInitScript(user => {
  localStorage.setItem('token','qa-only-token');
  localStorage.setItem('user',JSON.stringify(user));
  localStorage.setItem('creator_type','designer');
},user);
await context.route('**/api/**', async route => {
  const request=route.request(), url=new URL(request.url()), path=url.pathname;
  const send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
  if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path.endsWith('/users/me')) return send(user);
  if(path.endsWith('/onboarding/status')) return send({creator_type:'designer',locked:true});
  if(path.endsWith('/collaboration/partners')) { requests.push(Object.fromEntries(url.searchParams)); return send(partners); }
  return send([]);
});
try {
  const page=await context.newPage();
  await page.goto(`${base}/collaboration`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Maker Shop'}).waitFor({timeout:20000});
  const card = await page.locator('main, body').first().innerText();
  for (const text of ['5 days','₹4.5 per gram','₹200','220 × 220 × 250 mm','We print quickly.','FDM - PLA']) assert.ok(card.includes(text), `partner card shows "${text}"`);
  await page.getByLabel('Technology').selectOption('fdm');
  await page.waitForFunction(() => true);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(requests.at(-1).technology,'fdm');
  await page.getByLabel('Material').fill('PLA');
  await new Promise(r => setTimeout(r, 700));
  assert.equal(requests.at(-1).material_type,'PLA');
  await page.getByLabel('Smallest build size (mm)').fill('200');
  await new Promise(r => setTimeout(r, 400));
  assert.equal(requests.at(-1).min_build_mm,'200');
  // An impossible size is not sent to the server (it would be rejected), so the list stays honest.
  await page.getByLabel('Smallest build size (mm)').fill('5000');
  await new Promise(r => setTimeout(r, 400));
  assert.equal(requests.at(-1).min_build_mm, undefined);
  partners = [];
  await page.getByLabel('Smallest build size (mm)').fill('999');
  await page.getByText('No print partners match these filters. Try fewer filters.').waitFor();
  await page.getByLabel('Technology').selectOption('');
  await page.getByLabel('Material').fill('');
  await page.getByLabel('Smallest build size (mm)').fill('');
  await page.getByText('No print partners are taking work right now.').waitFor();
  await page.setViewportSize({width:375,height:812});
  partners = [partner];
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Maker Shop'}).waitFor({timeout:20000});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'no horizontal overflow at 375px');
  console.log('PASS creator partner list: rates, filters, empty states and phone width');
} finally {await context.close();await browser.close();}
