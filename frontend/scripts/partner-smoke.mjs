/** Partner packing fixture test; no real accounts, carrier calls or database. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge', headless:true});
const context = await browser.newContext({bypassCSP:true});
const user = {id:2,email:'partner@example.test',role:'print_partner'};
const job = {id:11,status:'qc',created_at:'2026-10-29T08:00:00',items:[],currency:'INR',total:1200};
const updates=[];
await context.addInitScript(user => {
  localStorage.setItem('token','qa-only-token');
  localStorage.setItem('user',JSON.stringify(user));
},user);
await context.route('**/api/**', async route => {
  const request=route.request(), path=new URL(request.url()).pathname;
  const send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
  if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path.endsWith('/users/me')) return send(user);
  if(path.endsWith('/partner/jobs')) return send([job]);
  if(path.endsWith('/partner/analytics')) return send({active_jobs:0,pending_qc:1,active_printers:0,maintenance_alerts:0});
  if(path.endsWith('/jobs/11/status')) {updates.push(request.postDataJSON());return send({detail:'Carrier unavailable; check Shiprocket before retrying'},503);}
  return send([]);
});
try {
  const page=await context.newPage();
  await page.goto(`${base}/partner`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Length (cm)').fill('15',{timeout:20000});
  await page.getByLabel('Breadth (cm)').fill('10');
  await page.getByLabel('Height (cm)').fill('8');
  await page.getByLabel('Weight (kg)').fill('0.4');
  await page.getByRole('button',{name:'Pack and create shipping label',exact:true}).click();
  await page.getByText('Carrier unavailable; check Shiprocket before retrying',{exact:true}).waitFor();
  assert.deepEqual(updates,[{status:'packed',shipping_package:{length_cm:15,breadth_cm:10,height_cm:8,weight_kg:0.4}}]);
  assert.equal(await page.getByRole('button',{name:'Mark as shipped',exact:true}).isDisabled(),true);
  console.log('PASS partner parcel measurements and carrier failure fixture');
} finally {await context.close();await browser.close();}
