import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, redactUrl, calculateCls, blockingTime, summarizeRuns, budgetFailures, recommendations, renderMarkdown } from './core.mjs';

test('CLI defaults, repeated URLs, profiles and bounded positive numbers', () => {
  assert.equal(parseOptions([]).urls.length, 3);
  assert.equal(parseOptions([]).runs, 3);
  const options = parseOptions(['--url', 'https://example.test/a?q=1', '--url=https://example.test/b', '--runs=2', '--profile=mobile', '--assert-budgets']);
  assert.equal(options.urls.length, 2);
  assert.equal(options.profile, 'mobile');
  assert.equal(options.assertBudgets, true);
  for (const args of [['--runs=0'], ['--runs=11'], ['--runs=NaN'], ['--runs=1.5'], ['--profile=watch'], ['--url=file:///tmp/x'], ['--url=https://user:secret@example.test'], ['--observe-ms=-1'], ['--timeout-ms=0'], ['--unknown']]) {
    assert.throws(() => parseOptions(args), undefined, args.join(' '));
  }
});

test('saved URLs remove query, fragment and credentials without dropping the path', () => {
  assert.equal(redactUrl('https://user:secret@example.test/a?token=private#secret'), 'https://example.test/a');
  assert.equal(redactUrl('data:text/plain,private'), '[non-http resource]');
  assert.equal(redactUrl('bad input'), '[invalid URL]');
});

test('CLS uses largest session, strict 1s gap and 5s length; excludes input shifts', () => {
  const entries = [
    { startTime: 0, value: .1 }, { startTime: 999, value: .1 },
    { startTime: 1999, value: .3 }, // 1000ms starts another session
    { startTime: 2000, value: 9, hadRecentInput: true },
    ...[2100, 3000, 3900, 4800, 5700, 6600, 7500].map(startTime => ({ startTime, value: .1 })),
  ];
  assert.ok(Math.abs(calculateCls(entries) - .9) < .00001);
  assert.equal(calculateCls([]), 0);
});

test('blocking diagnostic clips long-task excess to FCP and capture, absent FCP stays unknown', () => {
  const tasks = [{ startTime: 0, duration: 200 }, { startTime: 300, duration: 200 }];
  assert.equal(blockingTime(tasks, 100, 400), 150);
  assert.equal(blockingTime(tasks, null, 400), null);
  assert.equal(blockingTime([], 0, 400), 0);
});

const good = { ok: true, url: 'https://example.test/', metrics: { ttfbMs: 100, fcpMs: 200, lcpMs: 300, cls: 0, blockingTimeMs: 0 }, requests: [], pendingRequests: [], issues: [] };
test('summaries preserve zero, missing metrics and failed samples; budgets never pass incomplete runs', () => {
  const failed = { ...good, ok: false, metrics: {} };
  const missing = { ...good, metrics: { ...good.metrics, lcpMs: null } };
  const summary = summarizeRuns([good, { ...good, metrics: { ...good.metrics, ttfbMs: 300 } }, failed]);
  assert.equal(summary.metrics.ttfbMs.median, 200);
  assert.equal(summary.metrics.cls.median, 0);
  assert.equal(summary.failedRuns, 1);
  assert.equal(summary.metrics.lcpMs.samples, 2);
  assert.equal(budgetFailures([good]).length, 0);
  assert.ok(budgetFailures([good, failed]).length > 0);
  assert.ok(budgetFailures([good, missing]).length > 0);
  assert.ok(budgetFailures([{ ...good, pendingRequests: [{ type: 'Fetch' }] }]).length > 0);
  assert.ok(budgetFailures([{ ...good, metrics: { ...good.metrics, lcpMs: 2600 } }]).length > 0);
  const canceledPrefetch = { ...good, requests: [{ failed: true, canceled: true, status: 200, type: 'Fetch', bytes: 0 }] };
  assert.ok(budgetFailures([canceledPrefetch]).length > 0, 'Unclassified cancellation can hide an aborted required API');
  assert.equal(budgetFailures([{ ...canceledPrefetch, requests: [{ ...canceledPrefetch.requests[0], speculative: true }] }]).length, 0, 'Only explicitly speculative cancellation is exempt');
});

test('recommendations follow observed evidence and Markdown escapes remote data', () => {
  const run = { ...good, metrics: { ...good.metrics, ttfbMs: 2000, lcpMs: 4000, cls: .3, blockingTimeMs: 500 }, requests: [{ url: 'https://example.test/large.js', type: 'Script', bytes: 700000, durationMs: 2000, status: 200 }], pendingRequests: [{ url: 'https://example.test/api/items', type: 'Fetch' }] };
  const advice = recommendations(run).join(' ');
  assert.match(advice, /server|CDN/i);
  assert.match(advice, /JavaScript|split/i);
  assert.match(advice, /dimensions|space/i);
  assert.match(advice, /pending/i);
  const text = renderMarkdown({ generatedAt: 'test', options: { profile: 'desktop', runs: 1 }, browserVersion: 'test', runs: [{ ...good, url: 'https://example.test/a|<script>' }] });
  assert.ok(!text.includes('<script>'));
  assert.match(text, /INP.*not measured/i);
});
