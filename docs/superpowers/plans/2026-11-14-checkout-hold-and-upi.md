# Checkout Hold and UPI-first Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (executed natively in one session). Steps use checkbox syntax.

**Goal:** Keep the cart until paid, turn a started checkout into a 15-minute expiring hold, list only real orders, and make Razorpay payment UPI-first with a reliable return path on phones.

**Architecture:** Reuse today's pending-order row as the hold (no new table). Expiry and cart consumption live in `backend/app/services/payments.py`; the API gains `GET /api/checkout/hold` and `POST /api/checkout/callback`; the frontend gains pure option helpers, a return page, a hold banner and cart availability flags.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest (SQLite fixture + FakeRazorpay in `backend/tests/test_payments.py`); Next.js client components, node:test machines, Playwright smoke.

**Spec:** `docs/superpowers/specs/2026-11-14-checkout-hold-and-upi-design.md`

## Global Constraints
- Amounts are integer paise; `Order.amount_minor` is authoritative. Hold length `settings.CHECKOUT_HOLD_MINUTES = 15`.
- Paid status only via signed webhook, `/verify`, or `/callback` after reading the payment from Razorpay.
- Never release stock while a payment is `authorized`/`captured` or the provider is unreachable.
- Frontend: follow `frontend/AGENTS.md`; read `data-flow`/`data-state`; smoke scripts run against `http://localhost:3000`.

## Review Focus
- Customer opens checkout in two tabs (different idempotency keys) with the same cart: one hold, one stock reservation.
- Cart changed (quantity/coupon/address) after a hold started: old hold released, new one created; blocked if a payment is in flight.
- Payment succeeds after the cart was edited: only the paid quantity is removed, the new additions stay.
- Hold expires while the Razorpay window is open: late capture is refunded, never kept.
- Forged or replayed `/callback` POST: ignored, nothing reflected in the redirect.

## File Structure
- Modify `backend/app/services/payments.py` (hold lifecycle), `backend/app/api/routers/checkout.py`, `cart.py`, `orders.py`, `backend/app/models/order.py`, `backend/app/schemas/cart.py`, `backend/app/core/config.py`, `backend/app/worker/tasks.py`, migration `e5b7c2d9a418`.
- Create `frontend/src/lib/machines/payment-options.ts`, `frontend/src/app/checkout/return/page.tsx`, `frontend/src/components/marketplace/hold-banner.tsx`.
- Modify `frontend/src/app/checkout/page.tsx`, `cart/page.tsx`, `orders/page.tsx`, `frontend/src/lib/razorpay.ts`.

### Task 1: Hold lifecycle in the payment service
**Files:** `backend/app/services/payments.py`, `models/order.py` (`coupon_id`), migration, `core/config.py`; tests in `backend/tests/test_payments.py`, `test_partner_migration.py`.
**Produces:** `hold_expires_at(order) -> datetime`; `open_hold(db, user_id) -> Order | None`; `release_hold(db, order, reason) -> None`; `consume_cart(db, order) -> None`; `expire_stale_holds(db, *, customer_id=None, product_ids=None, limit=50) -> int`; `prepare_order` no longer deletes cart items and reuses/replaces the live hold.
- [ ] Tests (red): cart survives `start_payment`; same cart + new key returns the same order id and reserves stock once; changed quantity replaces the hold; replacing is refused (409) when a payment is `authorized`; paying removes only the paid quantity from a cart edited after the hold; stale unpaid hold is released (stock, coupon `times_used`, status `cancelled`) by `expire_stale_holds`; captured payment found while expiring settles the order instead; authorised/unreachable provider leaves it; hold without Razorpay id is released; another customer's stale hold on the same product is released when stock is needed.
- [ ] Implement; extend migration with `coupon_id`; run `python -m pytest -q -p no:cacheprovider tests/test_payments.py tests/test_partner_migration.py`.

### Task 2: API surface and Orders filtering
**Files:** `checkout.py`, `orders.py`, `cart.py`, `schemas/cart.py`, `worker/tasks.py`; tests in `test_payments.py`.
**Produces:** `GET /api/checkout/hold -> {"hold": null | {order_id, hold_expires_at, total, currency}}`; `hold_expires_at` (UTC ISO string ending in `Z`) on `CheckoutResponse`; `POST /api/checkout/callback` (form fields `razorpay_*`) -> 303 to `{FRONTEND_URL}/checkout/return?order_id=<id>` or `{FRONTEND_URL}/orders`; `payments.complete_callback(db, provider_order_id, payment_id, signature) -> int | None`; `GET /api/orders/` hides unpaid, never-progressed orders; cart items carry `unavailable_reason: str | None`.
- [ ] Tests (red): hold endpoint null/live/expired; callback with valid signature settles and redirects, forged signature redirects to `/orders` without settling, replay is harmless; orders list excludes a pending and an expired-cancelled hold but includes a paid-then-cancelled order; cart reports "unavailable" for unpublished product and "Only N left"/"Out of stock" for stocked physical lines.
- [ ] Implement; point `expire_pending_orders` at `expire_stale_holds`; run the full backend suite.

### Task 3: UPI-first Razorpay options and helpers
**Files:** create `frontend/src/lib/machines/payment-options.ts`, `frontend/scripts/machines/payment-options.test.mjs`; modify `frontend/src/lib/razorpay.ts`.
**Produces:** `upiFirstDisplay()`, `usesRedirectFlow(userAgent: string): boolean`, `holdSecondsLeft(expiresAt: string, now: number): number`, `formatCountdown(seconds: number): string`.
- [ ] Tests (red): display config has `sequence: ["block.upi_block","block.other_block"]`, UPI block first with `{method:"upi"}`, other block cards/netbanking/wallet, `show_default_blocks:false`; Android/iPhone UAs redirect, desktop Chrome does not; countdown clamps at 0 and formats `14:05`.
- [ ] Implement; `node --test scripts/machines/payment-options.test.mjs`.

### Task 4: Checkout, return page, banner, cart flags
**Files:** `checkout/page.tsx`, new `checkout/return/page.tsx`, new `hold-banner.tsx`, `cart/page.tsx`, `orders/page.tsx`, `scripts/checkout-razorpay-smoke.mjs`.
- [ ] Checkout passes `config.display`, `timeout` (seconds left, minimum 60), and on phones `redirect:true` + `callback_url = <API base>/api/checkout/callback`; shows the hold countdown; refuses to open an expired hold. Return page polls `/api/orders/<id>` and shows the existing payment messages. Banner shows on cart and Orders. Cart lines show `unavailable_reason` and disable Checkout.
- [ ] Extend the smoke: UPI config reaches Checkout.js, phone UA uses redirect/callback, expired hold blocks opening, banner visible with a live hold.
- [ ] Run `npm run test:unit`, eslint on changed files, `npm run build`, smoke scripts (checkout-razorpay, cart-orders, customer-options).

### Task 5: Docs and notes
- [ ] Update `docs/customer-launch.md` section 3 (hold, expiry without Celery, callback URL allow-list note) and the memory note.

## Self-review
Spec goals 1-7 map to Tasks 1-4; non-goals are untouched; names above are used consistently across tasks.
