# Startup support implementation plan

> **For agentic workers:** Use executing-plans inline, with a final independent review.

**Goal:** Let visitors optionally support 3DVerse's maintenance and growth.

**Architecture:** A public server-rendered page reads a validated hosted payment URL at runtime. Reuse MarketplaceShell and Button; provider owns the transaction and receipt.

**Tech stack:** Next.js App Router, TypeScript, existing Tailwind tokens, Node assertions and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-startup-support-design.md`

## Global constraints

- No new dependencies, fabricated destination, payment success claims or automatic subscription.
- Preserve existing identity, account and checkout wiring and unrelated working-tree files.
- User already authorized implementation, checks, commit and push; continue inline.

## Review focus

- Missing/invalid destination must never produce an active payment link.
- URL credentials and non-HTTPS schemes must be rejected.
- A guest must reach the provider directly without sign-in.
- A forged success query must never display payment confirmation.
- Long payment URLs and mobile widths must not break layout or keyboard access.

## Task 1: Optional support page

Files: create `frontend/src/lib/support.ts`, `frontend/src/app/support/page.tsx`, `frontend/scripts/support-test.mjs`, `frontend/scripts/support-smoke.mjs`; modify footer, sitemap, package scripts and browser-check runner.

Interface: `getSupportPaymentUrl(value: string | undefined): string | null` validates runtime config. Server page consumes `SUPPORT_PAYMENT_URL`; browser fixture passes expected URL as a CLI argument without visiting the provider.

- [x] Write URL regression checks for missing, whitespace, malformed, relative, HTTP, JavaScript, credentials, valid HTTPS and query preservation; run and observe failure.
- [x] Implement the helper and public page with configured and unavailable states, meaningful heading, purpose and contact/browse links.
- [x] Add footer/sitemap discovery, unit and browser CI integration. Browser checks exercise both config states, guest access, keyboard focus, mobile overflow and forged success query without transferring money.
- [x] Document activation in `.env.example`, README and launch guide.
- [x] Run unit checks, changed-file ESLint, build and browser fixtures; inspect desktop/mobile captures. Review diff before staging only feature files.
- [ ] Commit and push the branch.

## Execution ledger

- Ruling: create `feat/startup-support` in the existing checkout from merged `origin/main`; unrelated local files remain untouched. No simultaneous implementation needs a linked worktree, and this preserves the working local toolchain.
- Ruling: proceed with the hosted-link UI while the destination question remains pending. Leave payments visibly unavailable until an actual destination is supplied.
- TDD: `node scripts/support-test.mjs` failed on missing helper behavior, then passed after implementation.
- Verification: `npm.cmd run test:unit` passed all four scripts; changed-file ESLint passed, including a final check of the updated browser scripts. `npm.cmd run build` passed (52 generated pages; `/support` rendered dynamically).
- Verification: `BROWSER_CHANNEL=msedge npm.cmd run test:browser` passed the existing marketplace, purchase-option, auth and partner fixtures plus support unavailable/configured checks. Provider URL is a reserved test domain and is never visited; no money transferred.
- Review: independent code and screenshot review found no blocking defects. Its minor Tab-reachability coverage suggestion was implemented and passed. Desktop 1280px, mobile 375px and dark-mode screenshots inspected under ignored `frontend/.hallmark/verification/`.
- Hallmark: reused locked `frontend/design.md`, shared Button states and storefront tokens. Static scan of support page plus shared button/base styles: `0 FAIL, 0 REFLEX, 0 WARN`. Its separate render attempt timed out after 30 seconds; Playwright captures and browser assertions provide the visual verification. Initial page-only focus/active/disabled flags were resolved by including the shared styles, whose focus behavior was also verified by keyboard in the browser.
- Limit: owner payment destination and a real deployed contribution/receipt remain unverified. This feature introduces no backend changes; backend suite was not rerun.
