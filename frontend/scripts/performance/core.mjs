import { parseArgs } from 'node:util';

export const BUDGETS = { ttfbMs: 800, fcpMs: 1800, lcpMs: 2500, cls: .1, blockingTimeMs: 200 };
export const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, cpuSlowdown: 1, latencyMs: 0, downloadBps: null, uploadBps: null },
  mobile: { viewport: { width: 390, height: 844 }, cpuSlowdown: 4, latencyMs: 150, downloadBps: 200000, uploadBps: 93750 },
};

export function parseOptions(argv) {
  const { values } = parseArgs({ args: argv, options: {
    url: { type: 'string', multiple: true }, runs: { type: 'string', default: '3' },
    profile: { type: 'string', default: 'desktop' }, out: { type: 'string', default: 'performance-reports' },
    'observe-ms': { type: 'string', default: '10000' }, 'timeout-ms': { type: 'string', default: '30000' },
    'ready-selector': { type: 'string' }, 'assert-budgets': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) return { help: true };
  const integer = (name, min, max) => {
    const value = Number(values[name]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
    return value;
  };
  if (!Object.hasOwn(PROFILES, values.profile)) throw new Error('profile must be desktop or mobile');
  const urls = values.url ?? ['https://3dverse-tan.vercel.app/', 'https://3dverse-tan.vercel.app/marketplace', 'https://3dverse-tan.vercel.app/login'];
  if (!urls.length || urls.length > 10) throw new Error('Provide between 1 and 10 URLs');
  for (const value of urls) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URLs must use HTTP(S) without embedded credentials');
  }
  if (!values.out.trim()) throw new Error('out must be a directory');
  if (values['ready-selector'] !== undefined && !values['ready-selector'].trim()) throw new Error('ready-selector must not be empty');
  return { urls, runs: integer('runs', 1, 10), profile: values.profile, out: values.out,
    observeMs: integer('observe-ms', 100, 60000), timeoutMs: integer('timeout-ms', 100, 120000),
    readySelector: values['ready-selector'], assertBudgets: values['assert-budgets'] };
}

export function redactUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '[non-http resource]';
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return url.href;
  } catch { return '[invalid URL]'; }
}

export function calculateCls(entries) {
  let max = 0, sum = 0, first = 0, previous = 0;
  for (const entry of [...entries].sort((a, b) => a.startTime - b.startTime)) {
    if (entry.hadRecentInput) continue;
    if (sum && entry.startTime - previous < 1000 && entry.startTime - first < 5000) sum += entry.value;
    else { first = entry.startTime; sum = entry.value; }
    previous = entry.startTime;
    max = Math.max(max, sum);
  }
  return max;
}

// A bounded long-task diagnostic, not Lighthouse TBT (which requires its TTI window).
export function blockingTime(tasks, fcp, end) {
  if (fcp == null) return null;
  return tasks.reduce((total, task) => total + Math.max(0, Math.min(task.startTime + task.duration, end) - Math.max(task.startTime + 50, fcp)), 0);
}

const finite = value => typeof value === 'number' && Number.isFinite(value);
export const isRequestFailure = request => (request.failed && !request.canceled) || request.status >= 400;
const isIncompleteRequest = request => isRequestFailure(request) || (request.canceled && !request.speculative);
export function summarizeRuns(runs) {
  const names = [...new Set([...Object.keys(BUDGETS), ...runs.flatMap(run => Object.keys(run.metrics))])];
  const metrics = Object.fromEntries(names.map(name => {
    const values = runs.filter(run => run.ok).map(run => run.metrics[name]).filter(finite).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return [name, { samples: values.length, missing: runs.length - values.length,
      median: values.length ? (values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) : null,
      min: values[0] ?? null, max: values.at(-1) ?? null }];
  }));
  return { totalRuns: runs.length, successfulRuns: runs.filter(run => run.ok).length, failedRuns: runs.filter(run => !run.ok).length, metrics };
}

function groups(runs) {
  const result = new Map();
  for (const run of runs) {
    const key = run.targetId ?? run.url;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(run);
  }
  return [...result.values()];
}

export function budgetFailures(runs) {
  const failures = [];
  if (!runs.length) return ['No measurements'];
  for (const pageRuns of groups(runs)) {
    const url = pageRuns[0].url;
    if (pageRuns.some(run => !run.ok || run.pendingRequests.length || run.readyTimedOut || run.requests.some(isIncompleteRequest))) failures.push(`${url}: failed or incomplete observation`);
    const summary = summarizeRuns(pageRuns);
    for (const [name, budget] of Object.entries(BUDGETS)) {
      const metric = summary.metrics[name];
      if (metric.samples !== pageRuns.length) failures.push(`${url}: ${name} unavailable for one or more runs`);
      else if (metric.median > budget) failures.push(`${url}: median ${name} exceeds ${budget}`);
    }
  }
  return failures;
}

export function recommendations(run) {
  const m = run.metrics, advice = [];
  if (!run.ok) advice.push('Fix the navigation/HTTP failure first; an error page is not a successful speed result.');
  if (run.pendingRequests.length) advice.push(`${run.pendingRequests.length} requests remained pending at capture. Inspect slow APIs or background traffic; extend observation to distinguish unfinished content from polling.`);
  if (run.requests.some(isRequestFailure)) advice.push('Investigate failed requests and HTTP errors before treating a fast page shell as a healthy experience.');
  if (run.requests.some(r => r.canceled && !r.speculative)) advice.push('Unclassified or required requests were canceled: inspect application timeouts and missing data. Strict budgets treat these as incomplete; only explicitly marked speculative prefetch is exempt.');
  if (run.readyTimedOut) advice.push('The feature selector was not visible within the observation window. Check feature/API availability or verify the selector.');
  if (m.ttfbMs > BUDGETS.ttfbMs) advice.push('High TTFB: inspect DNS/TLS, CDN cache behavior and server work. Compare first and subsequent runs for possible backend/process warm-up; timing alone does not prove a cold start.');
  if (m.lcpMs > BUDGETS.lcpMs) advice.push('Late LCP: inspect the LCP resource and slow request list; prioritize visible content, avoid lazy-loading the main image and defer unrelated work.');
  if (m.fcpMs > BUDGETS.fcpMs) advice.push('Late first content: inspect render-blocking CSS/fonts and whether useful content waits for JavaScript or APIs.');
  if (m.blockingTimeMs > BUDGETS.blockingTimeMs) advice.push('Main-thread blocking: profile JavaScript execution, split heavy modules and defer nonessential scripts or 3D viewers until needed.');
  if (m.cls > BUDGETS.cls) advice.push('Layout shifts: reserve image/model dimensions and stable space for asynchronous content; check font fallback sizing.');
  if (run.requests.some(r => r.type === 'Image' && r.bytes > 250000)) advice.push('Large image transfers observed: inspect responsive dimensions and WebP/AVIF compression before changing quality.');
  if (run.requests.filter(r => r.type === 'Script').reduce((sum, r) => sum + r.bytes, 0) > 500000) advice.push('Over 500KB of JavaScript transferred: inspect route bundles and split code that the initial page does not need.');
  if (run.requests.some(r => ['Image', 'Script', 'Stylesheet', 'Font'].includes(r.type) && !r.longCache && r.status === 200)) advice.push('Review static-resource cache policy on the provider/CDN; use long immutable caching only for versioned public assets.');
  if (m.lcpMs == null) advice.push('LCP was unavailable: inspect page visibility/browser support or extend the observation window. Do not interpret missing data as zero.');
  if (!advice.length) advice.push('No configured loading-budget issues found in this bounded observation. Compare repeated mobile runs and real-user data before drawing a broader conclusion.');
  return advice;
}

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/[\\`*_[\]{}()|#\r\n]/g, character => character === '\n' || character === '\r' ? ' ' : `\\${character}`);
}
const display = value => finite(value) ? String(Math.round(value * 100) / 100) : 'unavailable';

export function renderMarkdown(report) {
  const lines = ['# Website loading analysis', '', `Generated: ${escape(report.generatedAt)}`, '',
    `Profile: ${escape(report.options.profile)}. Browser: ${escape(report.browserVersion)}. Fresh guest context per run; HTTP cache disabled; remote caches unchanged.`, '',
    ...(report.profile ? [`Viewport ${report.profile.viewport.width}×${report.profile.viewport.height}; CPU slowdown ${report.profile.cpuSlowdown}×; network latency ${report.profile.latencyMs}ms; download ${report.profile.downloadBps ?? 'unshaped'} bytes/s; upload ${report.profile.uploadBps ?? 'unshaped'} bytes/s.`, ''] : []),
    `Observation: ${report.options.observeMs ?? 'n/a'}ms after DOMContentLoaded/navigation failure. Navigation timeout: ${report.options.timeoutMs ?? 'n/a'}ms.`, '',
    'These are bounded lab observations, not a Lighthouse score or real-user Core Web Vitals assessment. INP, TTI and media buffering are not measured. Blocking time is an observed post-FCP long-task diagnostic. Feature-ready time is the first visibility detected from the navigation command, not proof the feature works. Connection time includes TLS. Transfer totals cover observed completed requests and omit redirect hops; pending bytes are unknown.', ''];
  for (const pageRuns of groups(report.runs)) {
    const summary = summarizeRuns(pageRuns);
    lines.push(`## ${escape(pageRuns[0].url)}`, '', `${summary.successfulRuns}/${summary.totalRuns} navigations succeeded. Failed runs are excluded from numeric summaries and still fail strict budgets.`, '',
      '| Metric | Median | Min | Max | Samples |', '| --- | ---: | ---: | ---: | ---: |');
    for (const [name, metric] of Object.entries(summary.metrics)) lines.push(`| ${escape(name)} | ${display(metric.median)} | ${display(metric.min)} | ${display(metric.max)} | ${metric.samples}/${summary.totalRuns} |`);
    lines.push('', 'Times are milliseconds; CLS is unitless; transferredBytes is bytes.', '', '### Improvement leads', '');
    for (const advice of new Set(pageRuns.flatMap(recommendations))) lines.push(`- ${escape(advice)}`);
    for (let i = 0; i < pageRuns.length; i++) {
      const run = pageRuns[i];
      lines.push('', `### Run ${i + 1}`, '', `Navigation: ${run.ok ? 'successful' : 'failed'}; HTTP ${run.status ?? 'unavailable'}; final URL: ${escape(run.finalUrl ?? run.url)}.`,
        `Issues: ${escape(run.issues.join('; ') || 'none observed')}. Pending requests: ${run.pendingRequests.length}. Canceled requests: ${run.requests.filter(r => r.canceled).length} (kept separate from confirmed failures).`,
        `LCP resource: ${escape(run.lcpResourceUrl || 'text element or unavailable')}.`, '',
        '| Slowest observed requests | Type | HTTP | Duration ms | Bytes |', '| --- | --- | ---: | ---: | ---: |');
      for (const request of [...run.requests, ...run.pendingRequests].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10)) lines.push(`| ${escape(request.url)} | ${escape(request.type)}${request.pending ? ' (pending)' : request.canceled ? ' (canceled)' : ''} | ${request.status ?? '—'} | ${display(request.durationMs)} | ${display(request.bytes)} |`);
      for (const request of run.requests.filter(isRequestFailure).slice(0, 10)) lines.push(`- Failed: ${escape(request.url)} (${escape(request.failureReason || `HTTP ${request.status ?? 'unknown'}`)})`);
      lines.push('', 'Largest completed transfers:', '');
      for (const request of [...run.requests].sort((a, b) => b.bytes - a.bytes).slice(0, 5)) lines.push(`- ${escape(request.url)}: ${display(request.bytes)} bytes (${escape(request.type)})`);
    }
  }
  lines.push('', '## Budget checks', '', ...budgetFailures(report.runs).map(failure => `- ${escape(failure)}`));
  if (!budgetFailures(report.runs).length) lines.push('All configured lab budgets passed.');
  lines.push('', 'Metric definitions: [TTFB](https://web.dev/articles/ttfb), [FCP](https://web.dev/articles/fcp), [LCP](https://web.dev/articles/lcp), [CLS](https://web.dev/articles/cls).', '');
  return lines.join('\n');
}
