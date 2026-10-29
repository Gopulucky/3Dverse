# Website performance analyzer implementation plan

> **For agentic workers:** Use executing-plans inline, followed by a fresh review.

**Goal:** Measure website loading delays and produce evidence-based improvement reports.
**Architecture:** CLI + pure analysis/report helpers + isolated Playwright collector. No product runtime changes or new dependencies.
**Tech stack:** Node 22, existing Playwright, Chromium CDP, node:test and local HTTP fixtures.
**Spec:** `docs/superpowers/specs/2026-10-29-performance-audit-design.md`

## Global constraints

- Preserve unrelated changes; base new branch on latest main, retaining the merged support feature.
- Report unavailable metrics honestly and lab limitations explicitly; no fabricated scores.
- No credentials, response bodies, remote text execution, customer writes or live CI timing gate.

## Review focus

- Zero versus absent values and wholly failed/mixed runs must not create false passing budgets.
- CLS windows must honor 1s gaps, 5s maximum and recent-input exclusion.
- Navigation timeout, HTTP error, pending fetch and selector timeout remain distinct and visible.
- Query/fragment credentials and Markdown syntax from target URLs must not leak or corrupt reports.
- Fresh contexts, explicit shaping and bounded observation must match recorded settings.

## Task 1: Analysis and reporting

Files: `frontend/scripts/performance/core.mjs`, `frontend/scripts/performance/core.test.mjs`.
Interfaces: `parseOptions(argv)`, `redactUrl(url)`, `calculateCls(entries)`, `blockingTime(tasks,fcp,end)`, `summarizeRuns(runs)`, `budgetFailures(runs)`, `recommendations(run)`, `renderMarkdown(report)`.

- [x] Write/run failing tests for CLI constraints, URL redaction, zero/missing metrics, CLS windows, observation-clipped blocking time, mixed/failed-run budgets and recommendations.
- [x] Implement pure helpers and Markdown report; verify tests pass.

## Task 2: Browser collection and command

Files: `frontend/scripts/performance/collect.mjs`, `frontend/scripts/performance-audit.mjs`, `frontend/scripts/performance-smoke.mjs`; modify package scripts, CI and `.gitignore`; document in `docs/performance.md` and README.
Interfaces: `measurePage(browser,url,options)` returns one redacted run; `audit(options)` returns a JSON-serializable report and writes both artifacts via the CLI.

- [x] Write/run failing local HTTP fixture checks for real timings, delayed feature/API, blocking task, error response, unfinished request, navigation timeout, mobile configuration and CLI artifact/exit behavior.
- [x] Implement pre-navigation observers, CDP requests/throttling, bounded observation, redaction and cleanup. No networkidle claim of readiness.
- [x] Wire pure tests into unit CI and local collector fixtures after Playwright installation; keep live-site scans manual.
- [x] Run unit/fixture checks, changed-file lint and required production build. Run the analyzer on public deployed 3DVerse pages, record actual findings and limits, and obtain independent review.

Delivery: review the staged diff, commit and push as previously authorized. Git history and the pull request record the delivery result.

## Execution ledger

- Ruling: work in the existing checkout on `feat/website-performance-audit`, from fetched main. No simultaneous implementation needs separate worktree/dependency copies; unrelated files are preserved.
- Ruling: interpret buffering as page/feature waiting time; optional selector measures visible feature readiness. Actual video buffering is outside scope.
- TDD: pure tests and browser fixture initially failed for missing modules; helpers then passed. The fixture exposed a long task occurring before FCP, so it now deliberately waits for first content before blocking. Separate watchdogs reproduced hangs after a failed pre-commit navigation and in a blocked renderer; skipping unavailable navigation contexts and a 1500ms snapshot cap fixed both.
- Review: an independent static reviewer found canceled requests could hide an aborted required API. The new regression failed, then passed after exempting only explicitly marked speculative requests from strict completeness checks. A real-browser fixture verifies both aborted required and router-prefetched requests. Reviewer confirmed the P2 resolved with no remaining blockers.
- Verification: `npm.cmd run test:unit` passed the four existing scripts plus six performance tests; `npm.cmd run lint:performance` passed; `npm.cmd run test:performance` passed real local HTTP/browser fixtures including CLI artifacts/exit, timeouts, blocked script and mobile profile. `npm.cmd run build` passed with 52 generated pages. `--help` passed and invalid CLI arguments returned Node exit 2 (PowerShell checked with explicit propagation of LASTEXITCODE).
- Live evidence: six initial desktop samples, one mobile sample, one longer marketplace sample and one actual product-card readiness sample completed against public production pages. Findings and scope limits are in `docs/performance-baseline-2026-10-29.md`; raw artifacts remain ignored.
- Limits: no changes to customer runtime/backend behavior, no live-provider transactions, no real-user metrics and no causal claim about a Render cold start. Existing fixture storefront checks will run in CI alongside the new isolated performance fixtures; live timings are informational only.
