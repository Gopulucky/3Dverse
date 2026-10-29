# 3DVerse loading observations — 29 October 2026

Measured the deployed public website using the new Playwright analyzer on the owner's Windows/Edge environment. These are a small set of lab samples, not real-user percentiles or a universal speed score. The frontend, backend and image host were contacted normally; no accounts, checkout actions or load-test traffic were used.

## Observed waiting time

| Check | Observation |
| --- | --- |
| Desktop homepage, two 10s captures | LCP 1.71–2.02s; TTFB 0.46–0.98s |
| Desktop sign-in, two 10s captures | LCP 1.39–1.44s |
| Initial marketplace captures | The shell painted in 1.30–1.89s, but the product API was still pending roughly 9.8s after it started; these captures were incomplete |
| Subsequent marketplace, 45s capture | Product API returned HTTP 200 after 3.05s; final observed LCP 6.42s |
| Marketplace with actual `.market-product` readiness selector, 15s capture | Product card first detected at 4.68s; API took 2.26s; final observed LCP 6.44s |
| Mobile homepage, one 10s capture | FCP 3.92s; LCP 4.97s; observed post-FCP blocking 1.16s; CLS 0 |

Mobile used 390×844, 4× CPU slowdown, 150ms emulated latency, 1.6Mbps down and 750Kbps up. Each capture used a fresh guest context and disabled client cache. Remote caches and hosting state were not reset. Some local fixture testing overlapped the initial desktop samples, so repeat baseline runs without other workloads before using small differences as a regression signal.

The later marketplace run's LCP resource was a product JPEG from the public Supabase image host: about 135KB transferred in 1.84s. Its visible product card appeared before that image became the largest painted content. This distinguishes initial page paint, product data readiness and image completion.

## Improvement order

1. **Make catalogue response time consistent.** Instrument `GET /api/marketplace/products` at the Render backend, including database time, and correlate the early pending requests with hosting logs. Compare warm and first-visit requests. Cold start, network and database behavior are possibilities; these browser samples do not prove which caused the wait.
2. **Investigate mobile JavaScript execution.** Capture a browser CPU trace on the homepage and inspect initial route bundles and automatic link prefetch. The mobile sample exceeded the project's observed-blocking budget; request sizes alone do not identify the executing module. Defer optional features only after attribution and compare the same profile again.
3. **Shorten the catalogue image path.** Inspect `ProductImage`, first-row image loading priority and the public image host's cache/transform settings. Test appropriately sized WebP/AVIF variants and first-visible-image priority. Keep below-fold images lazy; compare LCP and transfer bytes rather than assuming every image should preload.
4. **Measure product readiness as well as paint.** Use `.market-product` with the analyzer. A quick heading/loading placeholder must not count as a loaded catalogue. Preserve an honest empty/error state; no product match can also mean empty inventory, not slow loading.

In the readiness run, TTFB was 0.39s and request-to-first-byte wait was 0.07s. Earlier navigation TTFB often included substantial DNS/TLS time. Do not attribute all navigation latency to backend code. No production optimization has been applied by this tool-only change.

## Reproduce

From `frontend/`:

```bash
npm run perf -- --url https://3dverse-tan.vercel.app/ --profile mobile --runs 3
npm run perf -- --url https://3dverse-tan.vercel.app/marketplace --ready-selector .market-product --observe-ms 30000 --runs 3
```

Detailed artifacts are ignored under `frontend/performance-reports/`. The baseline session produced desktop `performance-2026-10-29T13-26-16-971Z-f0733471`, mobile `performance-2026-10-29T13-27-21-799Z-4ec9ad29`, deeper catalogue `deep/performance-2026-10-29T13-31-07-902Z-fad1bb2e` and feature readiness `feature/performance-2026-10-29T13-35-46-587Z-efc61b69` (each `.json` and `.md`). The final feature capture uses explicit speculative-request classification; earlier captures may label canceled prefetch as a failure. Their numeric timings are unchanged, and their failure counts should not be compared as a regression.

Read the [performance guide](performance.md) for measurement definitions and limitations.
