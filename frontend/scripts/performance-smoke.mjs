/** Local HTTP fixtures only. Tests real browser timing without contacting providers. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { measurePage } from './performance/collect.mjs';
import { budgetFailures } from './performance/core.mjs';

const timers = new Set();
const later = (fn, ms) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://fixture.test').pathname;
  if (path === '/timeout') return;
  if (path.startsWith('/never')) { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); return; }
  if (path === '/api/slow') return later(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }, 250);
  if (path === '/api/broken') { res.writeHead(503); res.end('broken'); return; }
  if (path === '/error') { res.writeHead(500); res.end('<h1>Error page</h1>'); return; }
  if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (path === '/blocked') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h1>Blocked script fixture</h1><script>setTimeout(()=>{const end=performance.now()+6000;while(performance.now()<end){}},300)</script>');
    return;
  }
  if (path === '/canceled') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<h1>Aborted request fixture</h1><script>
      const controller=new AbortController();
      fetch('/never/required',{signal:controller.signal}).then(r=>r.text()).catch(()=>{});
      fetch('/never/prefetch',{signal:controller.signal,headers:{'Next-Router-Prefetch':'1'}}).then(r=>r.text()).catch(()=>{});
      setTimeout(()=>controller.abort(),150);
    </script>`);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
    <h1>Performance fixture</h1><p>Visible content for paint measurements.</p><div id="ready" hidden>Ready</div>
    <script>
      fetch('/api/slow?token=PRIVATE_QUERY').then(r=>r.json()).then(()=>document.querySelector('#ready').hidden=false);
      fetch('/api/broken');
      ${path === '/pending' ? "fetch('/never');" : ''}
      const observer=new PerformanceObserver((list)=>{
        if(list.getEntries().some(entry=>entry.name==='first-contentful-paint')) {
          observer.disconnect();
          setTimeout(()=>{const end=performance.now()+180;while(performance.now()<end){}},100);
        }
      });
      observer.observe({type:'paint',buffered:true});
    </script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const options = { profile: 'desktop', observeMs: 900, timeoutMs: 3000, readySelector: '#ready' };
let browser, outputDirectory;
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true });
  const run = await measurePage(browser, `${base}/?token=PRIVATE_QUERY`, options);
  assert.equal(run.ok, true);
  assert.equal(run.status, 200);
  assert.ok(run.metrics.ttfbMs > 0);
  assert.ok(run.metrics.fcpMs > 0);
  assert.ok(run.metrics.lcpMs > 0);
  assert.ok(run.metrics.featureReadyMs >= 200);
  assert.ok(run.metrics.blockingTimeMs >= 50, JSON.stringify(run.metrics));
  assert.ok(run.requests.some(r => r.status === 503));
  assert.ok(run.requests.some(r => r.url.endsWith('/api/slow') && r.durationMs >= 200));
  assert.ok(!JSON.stringify(run).includes('PRIVATE_QUERY'));
  assert.ok(budgetFailures([run]).length > 0, 'Broken API must fail strict budgets');
  console.log('PASS desktop timing fixture');

  const pending = await measurePage(browser, `${base}/pending`, { ...options, readySelector: '#missing' });
  assert.equal(pending.readyTimedOut, true);
  assert.ok(pending.pendingRequests.some(r => r.url.endsWith('/never')));
  assert.ok(budgetFailures([pending]).length > 0);
  console.log('PASS pending feature fixture');
  const canceled = await measurePage(browser, `${base}/canceled`, { ...options, readySelector: undefined });
  assert.ok(canceled.requests.some(r => r.url.endsWith('/never/required') && r.canceled && !r.speculative));
  assert.ok(canceled.requests.some(r => r.url.endsWith('/never/prefetch') && r.canceled && r.speculative));
  assert.ok(budgetFailures([canceled]).length > 0, 'An aborted required API cannot pass strict budgets');
  console.log('PASS required versus speculative cancellation fixture');
  const error = await measurePage(browser, `${base}/error`, { ...options, readySelector: undefined, observeMs: 150 });
  assert.equal(error.ok, false);
  assert.equal(error.status, 500);
  console.log('PASS HTTP error fixture');
  let watchdog;
  const timeout = await Promise.race([
    measurePage(browser, `${base}/timeout`, { ...options, readySelector: undefined, timeoutMs: 350, observeMs: 100 }),
    new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('Collector exceeded bounded navigation timeout')), 5000); }),
  ]).finally(() => clearTimeout(watchdog));
  assert.equal(timeout.ok, false);
  assert.equal(timeout.metrics.ttfbMs, null);
  assert.ok(timeout.issues.includes('Navigation TimeoutError'));
  console.log('PASS bounded navigation timeout fixture');
  let blockedWatchdog;
  const blocked = await Promise.race([
    measurePage(browser, `${base}/blocked`, { ...options, readySelector: undefined, observeMs: 1000 }),
    new Promise((_, reject) => { blockedWatchdog = setTimeout(() => reject(new Error('Timing snapshot was not bounded for a blocked page')), 5000); }),
  ]).finally(() => clearTimeout(blockedWatchdog));
  assert.ok(blocked.issues.includes('Timing snapshot unavailable'));
  assert.equal(blocked.metrics.lcpMs, null);
  console.log('PASS bounded blocked-script fixture');
  const mobile = await measurePage(browser, `${base}/`, { ...options, profile: 'mobile', observeMs: 1200 });
  assert.equal(mobile.profile.viewport.width, 390);
  assert.equal(mobile.profile.cpuSlowdown, 4);
  assert.equal(mobile.profile.latencyMs, 150);
  assert.ok(mobile.metrics.fcpMs > 0);

  outputDirectory = await mkdtemp(join(tmpdir(), '3dverse-perf-test-'));
  const child = spawn(process.execPath, ['scripts/performance-audit.mjs', '--url', `${base}/error?token=PRIVATE_QUERY`, '--runs=1', '--observe-ms=150', '--out', outputDirectory], { windowsHide: true, stdio: 'pipe' });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1, stderr);
  const files = await readdir(outputDirectory);
  assert.equal(files.filter(file => file.endsWith('.json')).length, 1);
  assert.equal(files.filter(file => file.endsWith('.md')).length, 1);
  const json = await readFile(join(outputDirectory, files.find(file => file.endsWith('.json'))), 'utf8');
  assert.equal(JSON.parse(json).runs[0].status, 500);
  assert.ok(!`${json}${stdout}${stderr}`.includes('PRIVATE_QUERY'));
  console.log('PASS performance collector: paints, feature/API delay, long task, errors, pending fetch, timeout, mobile profile and CLI artifacts/exit');
} finally {
  await browser?.close();
  for (const timer of timers) clearTimeout(timer);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if (outputDirectory) {
    const cleanupPath = resolve(outputDirectory);
    assert.equal(dirname(cleanupPath), resolve(tmpdir()));
    assert.ok(basename(cleanupPath).startsWith('3dverse-perf-test-'));
    await rm(cleanupPath, { recursive: true, force: true });
  }
}
