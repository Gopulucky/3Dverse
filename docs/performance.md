# Website loading analysis

The [29 October 2026 baseline](performance-baseline-2026-10-29.md) records initial live observations and an improvement order.

Run the analyzer from `frontend/`. It measures public guest page visits and saves JSON plus a readable Markdown report. It uses the existing Playwright dependency, with no analytics key or account needed.

```bash
npm run perf
```

The default visits the deployed 3DVerse homepage, marketplace and sign-in three times each. Each run observes ten seconds after DOMContentLoaded, so the default takes at least 90 seconds plus navigation time. Requests are sequential; this is a loading diagnostic, not a concurrent load test.

Test a specific page or another website:

```bash
npm run perf -- --url https://3dverse-tan.vercel.app/ --profile mobile --runs 3
npm run perf -- --url https://example.com --url https://example.com/products --runs 2
```

On Windows PowerShell use `npm.cmd` if script execution blocks `npm`. Windows defaults to installed Microsoft Edge. On Linux install Playwright Chromium first:

```bash
npx playwright install --with-deps chromium
```

Set `BROWSER_CHANNEL=chromium`, `msedge` or `chrome` to choose an installed browser. A fresh private context is used for each measurement; existing account cookies are not used. The tool does not sign in, click forms, purchase anything or bypass HTTPS/CSP.

## What the measurements mean

| Report field | Meaning |
| --- | --- |
| `ttfbMs` | Navigation start to first response byte; includes connection setup and redirects |
| `serverWaitMs` | Request start to first response byte; includes network time, not just server CPU |
| `dnsMs`, `connectionMs`, `tlsMs` | Connection phases; TLS is part of connection time, not an extra phase to add twice |
| `fcpMs` | First visible content; it can still be a loading screen |
| `lcpMs` | Latest observed largest contentful paint within the capture window |
| `contentRevealGapMs` | FCP to LCP; a diagnostic gap, not a measurement of a spinner or media buffer |
| `cls` | Largest layout-shift session window: under 1s between shifts, under 5s total, excluding recent-input shifts |
| `blockingTimeMs` | Observed long-task time beyond 50ms after FCP, clipped at capture; not Lighthouse TBT or INP |
| `domContentLoadedMs`, `loadEventMs` | Browser lifecycle timings; neither proves API-driven content is ready |
| `featureReadyMs` | First visible selector detected after the navigation command; an upper-bound observation, not feature correctness |
| `transferredBytes` | Encoded bytes for observed completed requests, including headers; redirects and unfinished transfers are not fully counted |

Reports also list slow requests, largest transfers, HTTP/network failures and requests still pending at capture. Query strings, fragments and embedded credentials are removed from saved URLs. Canceled speculative requests are shown separately from confirmed failures. No request headers, response bodies, console messages or DOM text are saved. URL **paths** may still identify resources or users, so reports stay ignored by Git.

## Measure a feature's waiting time

Choose a CSS selector for the content customers are waiting for, not the page heading or a loading placeholder:

```bash
npm run perf -- --url https://3dverse-tan.vercel.app/marketplace --ready-selector .market-product --observe-ms 30000 --runs 1
```

`.market-product` selects an actual 3DVerse product card. For another website, use its real content selector. If no element becomes visible, the report records that the feature was unavailable within the window. This can mean slow/broken data, an empty result or a selector that needs correcting. The tool does not claim a timeout is automatically a performance defect.

Use a production build for local comparisons; development compilation/HMR adds overhead:

```bash
npm run build
npm run start
# In another terminal:
npm run perf -- --url http://127.0.0.1:3000 --runs 3
```

## Profiles and budgets

Desktop uses a 1440×900 viewport without artificial network/CPU shaping. Mobile uses 390×844, mobile/touch emulation, 4× CPU slowdown, 150ms network latency, 1.6Mbps download and 750Kbps upload. These are explicit lab settings, not a physical phone or an exact Lighthouse profile. Host CPU, routing, CDN cache, server warm-up and other machine activity affect results. HTTP cache is disabled and service workers blocked; remote CDN/backend caches are unchanged.

Default budgets are TTFB 800ms, FCP 1800ms, LCP 2500ms and CLS 0.1, following the linked metric guidance. The 200ms observed blocking-time budget is a project diagnostic choice. No INP, TTI, real-user percentile, SEO score or actual video-buffering result is generated.

```bash
npm run perf -- --url https://example.com --assert-budgets
npm run perf -- --help
```

Exit `0`: scan completed with successful document navigations; timing warnings remain informational. Exit `1`: navigation/HTTP failure or audit infrastructure error; with `--assert-budgets`, also a missing required metric, pending/failed request, unavailable feature or median budget breach. Exit `2`: invalid CLI arguments. HTTP-200 error pages cannot be reliably detected by navigation status; use a meaningful readiness selector and inspect the site.

Strict checks also flag unclassified/required request cancellations, such as an API aborted by an application timeout. Only requests explicitly marked as speculative through browser prefetch or Next.js router-prefetch headers are exempt. The report records a classification flag, not the headers themselves.

Options: `--runs` 1–10, up to ten repeated `--url` values, `--observe-ms` 100–60000, `--timeout-ms` 100–120000 (default 30000), `--out` directory, `--profile`, `--ready-selector` and `--assert-budgets`. Timing snapshots have a separate 1500ms cap so a blocked page script cannot hang collection indefinitely. A failed navigation leaves document timings unavailable. Every sample is retained; failed navigations are excluded from numeric medians but still fail strict budgets. Distinct supplied URLs are grouped separately even if redaction removes differing query strings.

## Turn findings into improvements

1. **Unfinished or failed product API:** inspect the exact endpoint, backend logs, database timings and hosting state. Increase observation to distinguish a long request from background polling. Fix availability before judging a fast shell as ready. A cold start is a hypothesis until server evidence confirms it.
2. **High TTFB:** compare connection phases with request-to-response wait. Check region/network/CDN behavior and server work; a large TLS phase is not proof that database queries are slow.
3. **Late LCP:** inspect the LCP resource and critical request chain. Serve responsive compressed images, prioritize the real main image and avoid waiting for unrelated scripts.
4. **Main-thread blocking:** profile CPU in browser DevTools; inspect large initial bundles and defer code such as 3D viewers until the customer uses it. Request duration alone does not attribute JavaScript execution cost.
5. **Layout shifts:** reserve dimensions for images, models and asynchronous content, and check fallback font sizing.
6. Repeat the same URLs, browser, profile and observation window after a change. Compare all runs, not just the fastest. Use production real-user telemetry separately for Core Web Vitals over actual visits.

## Repeatable checks

```bash
npm run test:unit
npm run test:performance
```

Pure tests verify budgets, redaction, CLI constraints and metric aggregation. Browser fixtures serve local pages with delayed APIs, unavailable features, a pending request, HTTP errors, long tasks, a blocked renderer and a navigation that never responds. CI runs these fixtures with Chromium. CI does not compare live website timings, which would mix network/provider variability with code regressions.

Metric sources: [TTFB](https://web.dev/articles/ttfb), [FCP](https://web.dev/articles/fcp), [LCP](https://web.dev/articles/lcp), [CLS](https://web.dev/articles/cls), [Playwright CDP](https://playwright.dev/docs/api/class-cdpsession).
