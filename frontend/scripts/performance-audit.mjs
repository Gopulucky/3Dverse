#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseOptions, renderMarkdown, budgetFailures } from './performance/core.mjs';
import { audit } from './performance/collect.mjs';

const HELP = `Website performance analysis (fresh guest browser visits)
  npm run perf -- --url https://example.com --profile mobile --runs 3
  --url URL             Repeat up to 10 times; defaults to 3DVerse /, /marketplace, /login
  --profile NAME        desktop (default) or mobile (shaped network, 4x CPU)
  --runs N              1-10 runs per URL; default 3
  --observe-ms N        100-60000ms after DOMContentLoaded; default 10000
  --timeout-ms N        100-120000ms navigation timeout; default 30000
  --ready-selector CSS  Optional visible-feature readiness check
  --out DIR             Report directory; default performance-reports
  --assert-budgets      Fail on missing metrics, incomplete runs or median budget violations
  --help                Print usage
Set BROWSER_CHANNEL=msedge, chrome or chromium to select an installed browser.
Lab observations only; no INP, Lighthouse score or actual media-buffer measurement.`;

let options;
try { options = parseOptions(process.argv.slice(2)); }
catch { console.error(`Invalid arguments. Use --help for supported options. URLs must use HTTP(S) without credentials; numbers must be in range.`); process.exitCode = 2; }
if (options?.help) console.log(HELP);
else if (options) {
  try {
    const report = await audit(options);
    const directory = resolve(options.out);
    await mkdir(directory, { recursive: true });
    const name = `performance-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    await writeFile(join(directory, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    await writeFile(join(directory, `${name}.md`), renderMarkdown(report), { flag: 'wx' });
    const failures = budgetFailures(report.runs);
    console.log(`Reports saved: ${join(directory, name)}.{json,md}`);
    console.log(`${report.runs.length} runs. ${failures.length} budget/completeness findings. Read the Markdown report for improvement leads.`);
    if (report.runs.some(run => !run.ok) || (options.assertBudgets && failures.length)) process.exitCode = 1;
  } catch {
    // Raw browser errors can contain target query tokens. Keep console output safe.
    console.error('Audit could not complete. Check the installed Playwright browser, target accessibility and output-directory permissions. No successful result is claimed.');
    process.exitCode = 1;
  }
}
