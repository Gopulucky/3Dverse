/** Partner hub fixture tests (packing, profile, availability, inbox); no real accounts, carrier calls or database. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge', headless:true});
const context = await browser.newContext({bypassCSP:true});
const user = {id:2,email:'partner@example.test',role:'print_partner'};
const job = {id:11,status:'qc',created_at:'2026-10-29T08:00:00',items:[],currency:'INR',total:1200};
const updates=[];
const calls=[];
let profile = {name:'Maker Shop',region:'Bengaluru',bio:null,accepting_work:false,lead_time_days:null,price_per_gram_inr:null,min_order_inr:null,build_x_mm:null,build_y_mm:null,build_z_mm:null,capabilities:[]};
const missing = () => [...(profile.capabilities.length ? [] : ['capabilities']), ...(profile.lead_time_days == null ? ['lead_time_days'] : []), ...(profile.price_per_gram_inr == null ? ['price_per_gram_inr'] : []), ...([profile.build_x_mm, profile.build_y_mm, profile.build_z_mm].some(v => v == null) ? ['build_volume'] : [])];
const snapshot = () => ({...profile, missing: missing()});
const ticket = (id, status, ref) => ({id, workflow_status: status, product_reference: ref, created_at: '2026-11-09T10:00:00', ticket_fee: 50, overflow_reason: null});
let tickets = [ticket(21,'design_submitted','Bracket v2'), ticket(22,'paid','Hinge set'), ticket(23,'sample_printing','Gear case'), ticket(24,'certified','Lid'), ticket(25,'agreed','Clip'), ticket(26,'pending_payment','Unpaid thing')];
await context.addInitScript(user => {
  localStorage.setItem('token','qa-only-token');
  localStorage.setItem('user',JSON.stringify(user));
},user);
await context.route('**/api/**', async route => {
  const request=route.request(), path=new URL(request.url()).pathname, method=request.method();
  const send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
  if(method==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path.endsWith('/users/me')) return send(user);
  if(path.endsWith('/partner/jobs')) return send([job]);
  if(path.endsWith('/partner/analytics')) return send({active_jobs:0,pending_qc:1,active_printers:0,maintenance_alerts:0});
  if(path.endsWith('/jobs/11/status')) {updates.push(request.postDataJSON());return send({detail:'Carrier unavailable; check Shiprocket before retrying'},503);}
  if(path.endsWith('/partner/profile') && method==='GET') return send(snapshot());
  if(path.endsWith('/partner/profile') && method==='PUT') {const body=request.postDataJSON(); calls.push(['PUT profile', body]); profile={...profile,...body}; return send(snapshot());}
  if(path.endsWith('/partner/capabilities') && method==='PUT') {const body=request.postDataJSON(); calls.push(['PUT capabilities', body]); profile={...profile,capabilities:body.items}; return send(snapshot());}
  if(path.endsWith('/partner/availability') && method==='PATCH') {
    const body=request.postDataJSON(); calls.push(['PATCH availability', body]);
    if(body.accepting_work && missing().length) return send({detail:{message:'Finish your profile before accepting work.',missing:missing()}},400);
    profile={...profile,accepting_work:body.accepting_work}; return send(snapshot());
  }
  if(path.endsWith('/collaboration/tickets') && method==='GET') return send(tickets);
  const accept = path.match(/\/collaboration\/tickets\/(\d+)\/accept$/);
  if(accept && method==='POST') {calls.push(['POST accept', Number(accept[1])]); tickets = tickets.map(t => t.id===Number(accept[1]) ? {...t, workflow_status:'sample_printing'} : t); return send(tickets.find(t => t.id===Number(accept[1])));}
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

  // Availability: off, and blocked until the profile is complete.
  const toggle = page.getByRole('switch',{name:'Accepting work'});
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'),'false');
  assert.equal(await toggle.isDisabled(),true,'cannot accept work with an incomplete profile');
  const hint = page.getByText('Finish your profile to start accepting work',{exact:false});
  await hint.waitFor();
  const hintText = await page.locator('[data-flow="partner-availability"]').innerText();
  for (const label of ['At least one capability','Lead time','Price per gram','Build volume']) assert.ok(hintText.includes(label), `missing item "${label}" is listed: ${hintText}`);

  // Profile tab: capabilities as chips, rates, build volume, one Save button.
  await page.getByRole('button',{name:/^Profile/}).click();
  await page.getByLabel('Lead time (days)').fill('5');
  await page.getByLabel('Price per gram (INR)').fill('4.5');
  await page.getByLabel('Minimum order (INR)').fill('200');
  await page.getByLabel('Build X (mm)').fill('220');
  await page.getByLabel('Build Y (mm)').fill('220');
  await page.getByLabel('Build Z (mm)').fill('250');
  await page.getByLabel('About your shop').fill('We print.');
  await page.getByLabel('Technology').selectOption('fdm');
  await page.getByLabel('Material').fill('PLA');
  await page.getByRole('button',{name:'Add capability',exact:true}).click();
  await page.getByRole('button',{name:'Remove FDM PLA',exact:true}).waitFor();
  await page.getByLabel('Technology').selectOption('sla');
  await page.getByLabel('Material').fill('Resin');
  await page.getByRole('button',{name:'Add capability',exact:true}).click();
  await page.getByRole('button',{name:'Remove SLA Resin',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Remove SLA Resin',exact:true}).count(),0);
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Finish your profile to start accepting work'), null, {timeout: 10000});
  const put = calls.find(c => c[0]==='PUT profile')[1];
  assert.deepEqual(put,{lead_time_days:5,price_per_gram_inr:4.5,min_order_inr:200,build_x_mm:220,build_y_mm:220,build_z_mm:250,bio:'We print.'});
  assert.deepEqual(calls.find(c => c[0]==='PUT capabilities')[1],{items:[{technology:'fdm',material:'PLA'}]});
  assert.equal(await toggle.isDisabled(),false);
  await toggle.click();
  // Target this switch by name: the navbar also has a day/night role="switch".
  await page.locator('[role="switch"][aria-label="Accepting work"][aria-checked="true"]').waitFor();
  assert.deepEqual(calls.find(c => c[0]==='PATCH availability')[1],{accepting_work:true});

  // Inbox: grouped, readable labels, next actions.
  await page.getByRole('button',{name:/^Inbox/}).click();
  const action = page.getByRole('button',{name:/^Needs action/});
  await action.waitFor();
  assert.match(await action.innerText(),/3/);
  assert.match(await page.getByRole('button',{name:/^In progress/}).innerText(),/1/);
  assert.match(await page.getByRole('button',{name:/^Closed/}).innerText(),/1/);
  const body = await page.locator('main, body').first().innerText();
  assert.ok(body.includes('Design received') && body.includes('Waiting for design') && body.includes('Printing sample'));
  assert.ok(!/design_submitted|sample_printing/.test(body), 'raw status codes must not be shown');
  assert.ok(!body.includes('Unpaid thing'), 'unpaid tickets are not in the inbox');
  assert.equal(await page.getByRole('link',{name:'Send quote'}).getAttribute('href'),'/collaboration/23');
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await page.getByRole('link',{name:'Send quote'}).nth(1).waitFor();
  assert.deepEqual(calls.find(c => c[0]==='POST accept'),['POST accept',21]);
  await page.getByRole('button',{name:/^In progress/}).click();
  await page.getByText('Quote sent').waitFor();
  await page.getByRole('button',{name:/^Closed/}).click();
  await page.getByText('Agreed',{exact:true}).waitFor();

  // Phone width: nothing spills sideways and the main actions are comfortably tall.
  await page.setViewportSize({width:375,height:812});
  await page.getByRole('button',{name:/^Needs action/}).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'no horizontal overflow at 375px');
  const heights = await page.getByRole('link',{name:'Send quote'}).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  assert.ok(heights.every(h => h >= 44), `Send quote links are at least 44px tall: ${heights}`);
  await page.getByRole('button',{name:/^Profile/}).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'no horizontal overflow on the profile tab at 375px');
  // Clearing the optional minimum order removes it (sent as null), and the form refreshes from the saved profile.
  await page.getByLabel('Minimum order (INR)').fill('');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await page.waitForFunction(() => true);
  for (let i = 0; i < 50 && !calls.some(c => c[0]==='PUT profile' && c[1].min_order_inr === null); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(calls.some(c => c[0]==='PUT profile' && c[1].min_order_inr === null), 'cleared minimum order is sent as null');
  assert.equal(await page.getByLabel('Minimum order (INR)').inputValue(),'');
  console.log('PASS partner parcel measurements, profile, availability, inbox and phone fixtures');
} finally {await context.close();await browser.close();}
