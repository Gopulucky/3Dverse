# Customer Launch Readiness Implementation Plan

> **For agentic workers:** Use Superpowers subagent-driven-development with explicit file ownership, regression tests, and a final fresh-context review.

**Goal:** Make 3DVerse understandable to Indian customers and correct the confirmed launch-blocking security and payment behaviour.

**Architecture:** Retain the existing Next.js/FastAPI stack and brand. Separate customer experience, payment lifecycle, and fulfilment/security changes by file ownership. Integrate the contracts below, then run full checks and review.

**Tech stack:** Next.js 16, React 19, TypeScript, FastAPI, SQLAlchemy/Alembic, PostgreSQL, Celery, existing Stripe/Shiprocket adapters.

**Spec:** `docs/superpowers/specs/2026-10-29-customer-launch-design.md`.

## Global constraints

India/INR, MIT as selected by the user; no fabricated customer metrics or delivery claims. Preserve legacy prices as USD and require deliberate INR repricing. Do not alter unrelated deletions. No live provider transactions or secrets in files. Existing brand is retained.

## Review focus

1. A first-time customer must distinguish a downloadable file from a delivered print.
2. A colliding print-partner ID must not grant another user's file access.
3. Retried or mismatched payment events must not duplicate fulfilment or mark an unrelated order paid.
4. Legacy USD listings must not silently be charged as INR.
5. Storage/carrier failure must not fabricate production success.

## Task 1: customer experience and catalogue

Own frontend except checkout page and partner page; own backend marketplace router and catalogue tests.
Create shared `frontend/src/lib/currency.ts`: `formatMoney(amount: number, currency?: string): string`, default INR.
Product/API records expose `currency`. Use it whenever an amount is displayed; preserve USD amounts.
Add `format=physical|digital` to catalogue requests and matching server filters, with tests. Support stable sorting and usable pagination without fake totals.
- [ ] Write regression checks for formats/sorting/currency and watch failure.
- [ ] Implement buyer-first homepage, clear choices, short how-it-works, labelled cards and coherent navigation.
- [ ] Verify desktop/mobile customer paths, error/empty states, loaded fonts and honest currency labels.

## Task 2: payment lifecycle and currency persistence

Own backend order/product/return models and schemas, all new Alembic migration(s), checkout/orders routers, payment service/models, invoice generation, frontend checkout page and payment tests. Own shared config additions. Other agents must coordinate model/config needs here.
Provide Product.currency and Order.currency (new INR, legacy USD), Order.delivered_at and Order.shipping_package JSON for Task 3. Keep response compatibility where possible.
`POST /checkout/create-payment-intent` must bind to a persisted pending order; response includes order_id/client_secret/total/currency. Frontend checkout collects and validates Indian address/contact before creating the payable order.
- [ ] Add failing tests for signed webhook validation, wrong amount/currency/order, duplicate events, retrying intent creation and production paid-state boundaries.
- [ ] Implement immutable order amount binding, INR minor-unit handling and idempotent payment success/failure handling, with database constraints/migration.
- [ ] Preserve safe non-live development behaviour, gated explicitly; no fake payment default in production.
- [ ] Prevent admin refund success without a confirmed provider outcome; coordinate admin router edits with root.
- [ ] Add tests and document remaining merchant/payout prerequisites.

## Task 3: private files and fulfilment safety

Own downloads router, collaboration and commission production mock-payment guards, partner router/page, shiprocket adapter, returns service, storage adapter and their tests. No model/config/migration edits; request additions from Task 2.
- [ ] Write failing authorization tests for unequal and colliding user/partner IDs.
- [ ] Reuse the existing partner identity helper and keep intended admin access.
- [ ] Reject fake production commission/collaboration payments; preserve explicitly local demo behaviour.
- [ ] Enforce order transitions; validate real parcel/contact data for shipping and surface carrier errors. Record delivery timestamp and base return deadlines on delivery.
- [ ] Reject non-durable production file-upload fallback; retain local development support.
- [ ] Run focused regressions and report external service limits honestly.

## Task 4: repository and launch readiness (coordinator)

Own README, MIT LICENSE, SECURITY.md, environment examples, launch/operator docs, CI, shared browser test integration and the progress ledger. Coordinate admin refund guard with payment task.
- [ ] Document the actual customer product, INR/legacy pricing, setup and production prerequisites.
- [ ] Add meaningful lint/browser checks to CI; keep isolated fixture tests explicitly labelled.
- [ ] Record evidence and outstanding operator actions without claiming live readiness.
- [ ] Run backend suite, frontend build/type/lint and customer browser checks; fresh-context whole-change review and fix concrete findings.
