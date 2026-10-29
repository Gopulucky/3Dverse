import { chromium } from 'playwright';
import { PROFILES, redactUrl, calculateCls, blockingTime, isRequestFailure } from './core.mjs';

// Runs in the page before its own scripts. Store timings, never DOM text or bodies.
function installObservers() {
  const state = { lcp: null, shifts: [], tasks: [], supported: PerformanceObserver.supportedEntryTypes, observers: [] };
  window.__loadingAudit = state;
  const listen = (type, consume) => {
    if (!state.supported.includes(type)) return;
    const observer = new PerformanceObserver(list => list.getEntries().forEach(consume));
    observer.observe({ type, buffered: true });
    state.observers.push({ observer, consume });
  };
  listen('largest-contentful-paint', entry => { state.lcp = { time: entry.startTime, url: entry.url || '' }; });
  listen('layout-shift', entry => { state.shifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput }); });
  listen('longtask', entry => { state.tasks.push({ startTime: entry.startTime, duration: entry.duration }); });
}

export async function measurePage(browser, url, options) {
  const profile = PROFILES[options.profile];
  const mobile = options.profile === 'mobile';
  const context = await browser.newContext({ viewport: profile.viewport, isMobile: mobile, hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1, serviceWorkers: 'block', acceptDownloads: false,
    ...(mobile ? { userAgent: `Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Mobile Safari/537.36` } : {}),
  });
  const issues = [], requests = [], pending = new Map();
  let status = null, navigationCompleted = false, featureReadyMs = null, readyTimedOut = false, pageErrors = 0, consoleErrors = 0;
  try {
    await context.addInitScript(installObservers);
    const page = await context.newPage();
    page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
    page.on('pageerror', () => { pageErrors++; });
    page.on('console', message => { if (message.type() === 'error') consoleErrors++; });
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) status = response.status();
    });
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });
    if (mobile) await client.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latencyMs, downloadThroughput: profile.downloadBps, uploadThroughput: profile.uploadBps, connectionType: 'cellular4g' });
    client.on('Network.requestWillBeSent', event => {
      const headers = Object.fromEntries(Object.entries(event.request.headers).map(([name, value]) => [name.toLowerCase(), value]));
      const speculative = /\bprefetch\b/i.test(`${headers.purpose || ''} ${headers['sec-purpose'] || ''}`)
        || headers['next-router-prefetch'] === '1' || Object.hasOwn(headers, 'next-router-segment-prefetch');
      pending.set(event.requestId, { url: redactUrl(event.request.url), type: event.type, status: null, bytes: 0,
        start: event.timestamp, wallStart: performance.now(), longCache: false, speculative });
    });
    client.on('Network.responseReceived', event => {
      const request = pending.get(event.requestId);
      if (!request) return;
      request.status = event.response.status;
      const cache = Object.entries(event.response.headers).find(([name]) => name.toLowerCase() === 'cache-control')?.[1] || '';
      request.longCache = /(?:s-maxage|max-age)\s*=\s*([1-9]\d{4,})/i.test(cache) && !/no-store|private/i.test(cache);
    });
    const finish = (event, failed) => {
      const request = pending.get(event.requestId);
      if (!request) return;
      requests.push({ url: request.url, type: request.type, status: request.status, longCache: request.longCache,
        bytes: event.encodedDataLength ?? 0, durationMs: Math.max(0, (event.timestamp - request.start) * 1000), failed,
        canceled: Boolean(event.canceled), speculative: request.speculative,
        failureReason: /^net::ERR_[A-Z0-9_]+$/.test(event.errorText || '') ? event.errorText : null });
      pending.delete(event.requestId);
    };
    client.on('Network.loadingFinished', event => finish(event, false));
    client.on('Network.loadingFailed', event => finish(event, true));

    const navigationStart = performance.now();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
      navigationCompleted = true;
    } catch (error) {
      // Playwright messages contain full URLs. Record only the safe error class.
      issues.push(`Navigation ${error.name === 'TimeoutError' ? 'TimeoutError' : 'Error'}`);
    }
    if (status !== null && status >= 400) issues.push(`Document HTTP ${status}`);
    await Promise.all([
      page.waitForTimeout(options.observeMs),
      options.readySelector && navigationCompleted ? page.locator(options.readySelector).first().waitFor({ state: 'visible', timeout: options.observeMs })
        .then(() => { featureReadyMs = performance.now() - navigationStart; })
        .catch(() => { readyTimedOut = true; issues.push('Feature selector unavailable'); }) : Promise.resolve(),
    ]);
    let snapshot = null;
    let snapshotTimer;
    try {
      // A failed pre-commit navigation has no usable execution context. Waiting
      // for evaluate() there can outlive the navigation timeout indefinitely.
      snapshot = navigationCompleted ? await Promise.race([page.evaluate(() => {
        const state = window.__loadingAudit;
        if (!state) return null;
        for (const { observer, consume } of state.observers) { observer.takeRecords().forEach(consume); observer.disconnect(); }
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
        return { lcp: state.lcp, shifts: state.shifts, tasks: state.tasks, supported: state.supported, fcp, end: performance.now(),
          nav: nav ? { startTime: nav.startTime, responseStart: nav.responseStart, requestStart: nav.requestStart,
            domainLookupStart: nav.domainLookupStart, domainLookupEnd: nav.domainLookupEnd, connectStart: nav.connectStart, connectEnd: nav.connectEnd,
            secureConnectionStart: nav.secureConnectionStart, domContentLoadedEventEnd: nav.domContentLoadedEventEnd, loadEventEnd: nav.loadEventEnd } : null };
      }), new Promise((_, reject) => { snapshotTimer = setTimeout(() => reject(new Error('Snapshot timeout')), 1500); })]) : null;
    } catch { issues.push('Timing snapshot unavailable'); }
    finally { clearTimeout(snapshotTimer); }
    const n = snapshot?.nav;
    const pendingRequests = [...pending.values()].map(request => ({ url: request.url, type: request.type, status: request.status,
      durationMs: Math.max(0, performance.now() - request.wallStart), bytes: null, pending: true }));
    if (pageErrors) issues.push(`${pageErrors} JavaScript page errors (messages omitted)`);
    if (consoleErrors) issues.push(`${consoleErrors} console errors (messages omitted)`);
    const failedRequests = requests.filter(isRequestFailure).length;
    if (failedRequests) issues.push(`${failedRequests} failed network/HTTP requests`);
    const lcp = snapshot?.lcp?.time ?? null;
    return { url: redactUrl(url), finalUrl: redactUrl(page.url()), status,
      ok: navigationCompleted && status !== null && status >= 200 && status < 400,
      profile, readyTimedOut, issues, requests: requests.map(request => ({ ...request })), pendingRequests,
      lcpResourceUrl: snapshot?.lcp?.url ? redactUrl(snapshot.lcp.url) : null,
      metrics: {
        ttfbMs: n?.responseStart > 0 ? n.responseStart - n.startTime : null,
        serverWaitMs: n?.responseStart > 0 ? n.responseStart - n.requestStart : null,
        dnsMs: n ? n.domainLookupEnd - n.domainLookupStart : null,
        connectionMs: n ? n.connectEnd - n.connectStart : null,
        tlsMs: n?.secureConnectionStart > 0 ? n.connectEnd - n.secureConnectionStart : null,
        fcpMs: snapshot?.fcp ?? null, lcpMs: lcp,
        contentRevealGapMs: lcp !== null && snapshot?.fcp !== null ? Math.max(0, lcp - snapshot.fcp) : null,
        cls: snapshot?.supported.includes('layout-shift') ? calculateCls(snapshot.shifts) : null,
        blockingTimeMs: snapshot?.supported.includes('longtask') ? blockingTime(snapshot.tasks, snapshot.fcp, snapshot.end) : null,
        domContentLoadedMs: n?.domContentLoadedEventEnd > 0 ? n.domContentLoadedEventEnd - n.startTime : null,
        loadEventMs: n?.loadEventEnd > 0 ? n.loadEventEnd - n.startTime : null,
        featureReadyMs, observationEndMs: snapshot?.end ?? null,
        transferredBytes: requests.reduce((sum, request) => sum + request.bytes, 0),
      } };
  } finally { await context.close(); }
}

export async function audit(options) {
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium');
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const report = { generatedAt: new Date().toISOString(), browserVersion: browser.version(), browserChannel: channel,
      options: { profile: options.profile, runs: options.runs, observeMs: options.observeMs, timeoutMs: options.timeoutMs,
        featureSelectorConfigured: Boolean(options.readySelector), assertBudgets: options.assertBudgets }, profile: PROFILES[options.profile], runs: [] };
    for (let target = 0; target < options.urls.length; target++) {
      for (let run = 1; run <= options.runs; run++) {
        console.log(`Measuring page ${target + 1}/${options.urls.length}, run ${run}/${options.runs} (${options.profile})`);
        report.runs.push({ ...await measurePage(browser, options.urls[target], options), targetId: target + 1, run });
      }
    }
    return report;
  } finally { await browser.close(); }
}
