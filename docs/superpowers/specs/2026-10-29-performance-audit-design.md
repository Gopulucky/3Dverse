# Website performance analyzer

The owner wants code to measure website speed, waiting/loading time and how to improve it. Implement a developer command, not a new customer-facing screen. Default to 3DVerse's public homepage, marketplace and sign-in; allow repeated `--url` arguments for any HTTP(S) page without embedded credentials.

## Approach

Reuse installed Playwright and Chromium performance APIs. A Lighthouse integration would add dependencies and a separate score model; a server-only HTTP timer would miss rendering and JavaScript delays. The chosen browser approach gives actionable request and rendering evidence without another dependency. This is the implementer's choice within the user's implementation request and existing autonomous workflow.

Measure fresh-context guest navigations sequentially, three runs per URL by default. Desktop is unthrottled; mobile uses a 390×844 viewport, touch/mobile emulation, 4× CPU slowdown and explicit network shaping (150ms latency, 1.6Mbps download, 750Kbps upload). Document that emulation and headless lab results vary by machine and are not real-user Core Web Vitals or a Lighthouse score. No sign-in, clicking, checkout, video playback or load test.

Report TTFB from navigation start, server wait separately, DNS/connection phases, FCP, LCP, FCP-to-LCP gap, session-window CLS, DOMContentLoaded/load events, observed long-task blocking time after FCP, transferred bytes, slow/large requests, failed HTTP/network requests and requests still pending at capture. Optional `--ready-selector` measures the time a specific feature becomes visible. Missing metrics remain null; a timeout or HTTP error never becomes a successful zero. Do not claim INP, TTI or actual media buffering measurements.

Capture for `--observe-ms` (default 10000) after DOMContentLoaded or a bounded navigation failure; `--timeout-ms` defaults to 30000. Validate CLI numbers and profile before launching the browser. Fresh contexts plus disabled HTTP cache and blocked service workers reduce client cache effects; remote CDN/backend caches and process warming are not reset. Preserve run order and raw successful/failed samples. Summaries show median/min/max and counts rather than field percentiles from three runs.

Save timestamped JSON and Markdown under ignored `frontend/performance-reports/`, including browser/version, profile, observation settings, metric availability and evidence-based recommendations. URL queries/fragments/userinfo are removed from saved URLs and request lists; no cookies, headers, response bodies, DOM text, screenshots or credentials are saved. URL paths can still contain identifying data; reports stay ignored. Markdown treats remote text as data. Requests never bypass TLS or CSP.

Budgets: TTFB ≤800ms, FCP ≤1800ms, LCP ≤2500ms, CLS ≤0.1; blocking-time diagnostic budget ≤200ms is a project choice, not a Core Web Vital. `--assert-budgets` exits 1 for any failed/incomplete run, missing required metrics or median budget breach. Normal diagnostics still exit 1 for navigation/HTTP failures, but slow pages alone are informational. Unknown CLI arguments exit 2. Limit each invocation to 10 URLs × 10 runs. No live-site performance gates in CI; use a local HTTP fixture for deterministic collector behavior.

Recommendations link evidence to possible fixes: slow initial response → inspect CDN/server/API latency; late LCP → prioritize visible content and its resources; long tasks/large JS → inspect splitting and defer unrelated modules; large images → responsive compression; shifts → reserve dimensions; pending/failed API → investigate reliability before calling a fast shell a success. These are diagnostic leads, not proven causal attribution.

Primary metric references: [TTFB](https://web.dev/articles/ttfb), [FCP](https://web.dev/articles/fcp), [LCP](https://web.dev/articles/lcp), [CLS session windows](https://web.dev/articles/cls), [Playwright CDP](https://playwright.dev/docs/api/class-cdpsession).
