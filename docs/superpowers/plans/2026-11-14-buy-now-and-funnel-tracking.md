# Buy Now and Funnel Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buy Now pays for one product only, and the site records an anonymous, per-channel purchase funnel the owner can read.

**Architecture:** Checkout accepts an optional `direct_item` that is priced by the existing `price_line` and bypasses the cart; direct lines are flagged `buy_now` in `selected_config` so paid orders never touch the cart. A `funnel_events` table plus a public batch endpoint receives browser events; `paid` is written server-side in the payment-verified path. An admin endpoint and page read the funnel.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest (SQLite `payment_db` fixture); Next.js (breaking-changes version, read `frontend/node_modules/next/dist/docs/` first), React Query, `scripts/machines/*.test.mjs` unit tests.

**Spec:** `docs/superpowers/specs/2026-11-14-buy-now-and-funnel-tracking-design.md`

## Global Constraints

- Direct orders must never read, change or empty the cart.
- Tracking stores no email, name, phone or address; only anonymous ID, event name, product id, source/medium/campaign, path.
- `paid` event is written only by the server after payment verification.
- Event names whitelist: `landing, product_view, viewer_opened, add_to_cart, buy_now, checkout_started, payment_opened, waitlist_joined, paid`.
- Frontend: keep existing `data-flow`/`data-state` attributes, visible text and roles; follow `frontend/design.md`. Windows: use `npm.cmd` if `npm` is restricted.
- Do not commit unless the owner asks; preserve unrelated working-tree changes.

## Review Focus

- Same product in cart and Buy Now: paying the direct order leaves the cart line intact (Task 1).
- A live cart hold is not reused for a direct purchase of the same product, nor the reverse (Task 1).
- Buy Now of an unavailable/USD/unpublished product fails with the same errors as the cart (Task 1).
- Event endpoint rejects unknown names, oversized batches and malformed anon IDs without erroring the page (Task 3).
- Tracking failures (offline, blocked storage) never throw into the UI (Task 4).

---

### Task 1: Buy Now on the backend

**Files:**
- Modify: `backend/app/api/routers/checkout.py` (request model), `backend/app/services/payments.py` (`prepare_order`, `hold_matches`, `consume_cart`)
- Test: `backend/tests/test_buy_now.py` (reuse `payment_db`, `seed_cart` patterns from `tests/test_payments.py`; import them or copy the fixture)

**Interfaces:**
- Produces: `class DirectItem(BaseModel)`: `product_id: int`, `quantity: int = Field(1, ge=1, le=100)`, `purchase_type: Literal["digital","physical"]`, `selected_config: dict | None = None`; `CheckoutRequest.direct_item: DirectItem | None = None`.
- Produces: order lines created from a direct item carry `selected_config["buy_now"] == True`.

- [ ] **Step 1: Write failing tests** in `test_buy_now.py`: (a) with a cart holding product A (qty 2) and a second product B, `prepare_order` with `direct_item` for B yields an order with exactly one line (B, qty 1) and the right total; (b) after the order is marked paid via the existing settle path, the cart still contains A and B unchanged; (c) direct item for the same product that is also in the cart: after paying, the cart line quantity is unchanged; (d) with a live hold from the cart for product A, a direct request for A creates a new order (cart hold cancelled) and the reverse; (e) unpublished / USD product raises `HTTPException` 409 as in cart checkout; (f) empty cart is fine for a direct order; (g) physical direct item still requires a valid address.
- [ ] **Step 2: Run** `python -m pytest -q -p no:cacheprovider tests/test_buy_now.py` in `backend/`. Expected: FAIL (no `direct_item`).
- [ ] **Step 3: Implement.** In `prepare_order`: when `request.direct_item` is set, load the `Product` (404 if missing), build a lightweight line source with `.product`, `.product_id`, `.quantity`, `.selected_config` (merge `purchase_type`, set `buy_now: True`), price with `price_line`, skip the "cart is empty" check and the cart lock, and include the direct product id in the `expire_stale_holds` scope. Extend `hold_matches` tuples with `bool(selected_config.get("buy_now"))`. In `consume_cart`, `continue` for lines whose `selected_config` has `buy_now`.
- [ ] **Step 4: Run** the same command plus `tests/test_payments.py`. Expected: PASS.

### Task 2: Buy Now on the frontend

**Files:**
- Create: `frontend/src/lib/buy-now.ts` (pure helpers), `frontend/scripts/machines/buy-now.test.mjs`
- Modify: `frontend/src/app/marketplace/[id]/page.tsx` (`handleBuyNow`), `frontend/src/app/checkout/page.tsx`

**Interfaces:**
- Produces: `type BuyNowItem = { product_id: number; quantity: 1; purchase_type: "digital"|"physical"; selected_config: Record<string,string> }`; `buyNowKey(userId: number|string|undefined): string`; `readBuyNow(storage: Pick<Storage,"getItem">, userId): BuyNowItem | null` (null on missing/invalid JSON/wrong shape); `saveBuyNow(storage: Pick<Storage,"setItem">, userId, item): void`.

- [ ] **Step 1: Write failing unit test** `buy-now.test.mjs` (loader pattern from `scripts/load-ts.mjs`): round trip; invalid JSON, missing fields, quantity != 1 and unknown `purchase_type` all return `null`.
- [ ] **Step 2: Run** `npm.cmd run test:unit` in `frontend/`. Expected: FAIL.
- [ ] **Step 3: Implement** `buy-now.ts`.
- [ ] **Step 4: Wire** the product page: `handleBuyNow` saves the item with `saveBuyNow` (no `/api/cart/items` call, no cart count change) then `router.push("/checkout?buy=now")`; login redirect keeps `next` as the product page. Wire checkout: when `?buy=now` and `readBuyNow` returns an item, the review list shows that product (fetch product details with the existing product endpoint), `hasPhysical` follows `purchase_type`, "Back to product" replaces "Back to cart", the create-payment-intent body includes `direct_item`, and `setItemCount(0)` is not called. Attempt key in `sessionStorage` is namespaced `-buynow`.
- [ ] **Step 5: Run** unit tests, `npm.cmd run build`, ESLint on changed files. Expected: pass.

### Task 3: Funnel events backend

**Files:**
- Create: `backend/app/models/funnel_event.py`, `backend/app/schemas/funnel.py`, `backend/app/api/routers/funnel.py`, `backend/alembic/versions/<new>_funnel_events.py` (copy header style of `d2e8b4c6a913_waitlist_signups.py`; `down_revision` = current head), `backend/tests/test_funnel.py`
- Modify: `backend/app/main.py` (mount at `/api/events`), `backend/app/services/payments.py` (write `paid` in the path that sets `payment_verified_at`)

**Interfaces:**
- Produces: `FunnelEvent` model (`id, anon_id(64), event(32), product_id|None, source(64)|None, medium(64)|None, campaign(64)|None, path(200)|None, created_at`); `POST /api/events` body `{anon_id, events:[{event, product_id?, source?, medium?, campaign?, path?}]}` (max 20) returns 204; `GET /api/events/admin/funnel` (admin only) returns `{steps:[{event,count,unique_visitors}], by_source:[{source, steps:{event:count}}], by_product:[{product_id,title,views,carts,buys,paid}]}`; `record_paid(db, order)` helper in `funnel.py` that stores `paid` once per order.

- [ ] **Step 1: Write failing tests** (SQLite `payment_db`-style fixture): valid batch stores rows; unknown event name → 422; 21 events → 422; `anon_id` not matching `^[A-Za-z0-9_-]{8,64}$` → 422; POST route has a `rate_limit` dependency (pattern in `test_waitlist.py`); `paid` is not accepted from the browser; `record_paid` is idempotent per order; summary maths for steps/by_source (pure function `summarise_funnel(rows)` tested directly); admin route rejects non-admins (pattern from waitlist admin).
- [ ] **Step 2: Run** `python -m pytest -q -p no:cacheprovider tests/test_funnel.py`. Expected: FAIL.
- [ ] **Step 3: Implement** model, schema (pydantic `Literal` for browser event names, excluding `paid`), router, migration, mount, and the `record_paid` call after payment verification.
- [ ] **Step 4: Run** full backend suite `python -m pytest -q -p no:cacheprovider`. Expected: PASS.

### Task 4: Tracker, wiring, admin page, privacy

**Files:**
- Create: `frontend/src/lib/track.ts`, `frontend/scripts/machines/track.test.mjs`, `frontend/src/app/admin/funnel/page.tsx`
- Modify: product page (`product_view`, `viewer_opened`, `add_to_cart`, `buy_now`), `frontend/src/components/marketplace/home-waitlist.tsx` (`waitlist_joined`), checkout page (`checkout_started`, `payment_opened`), a client component mounted in `frontend/src/app/layout.tsx` for `landing`, `frontend/src/components/layout/admin-shell.tsx` (nav link), `frontend/src/app/privacy/page.tsx`

**Interfaces:**
- Produces: `parseSource(search: string): { source: string|null; medium: string|null; campaign: string|null }` (`?src=` wins over `utm_source`; values trimmed, max 64 chars, `[A-Za-z0-9_.-]` only else null); `newAnonId(): string`; `track(event: TrackEvent, extra?: { productId?: number }): void` never throws, batches via `navigator.sendBeacon` or `fetch(..., { keepalive: true })`; `type TrackEvent` = the browser-sendable names.

- [ ] **Step 1: Write failing unit test** `track.test.mjs` for `parseSource` (src precedence, junk and overlong values → null, empty string → null) and `newAnonId` format.
- [ ] **Step 2: Run** `npm.cmd run test:unit`. Expected: FAIL.
- [ ] **Step 3: Implement** `track.ts` (first-touch source kept in `localStorage`, `anon_id` in `localStorage`, everything wrapped in try/catch; no-op during SSR) and wire the call sites listed above.
- [ ] **Step 4: Admin page** `/admin/funnel` using React Query against `/api/events/admin/funnel`: steps table with drop-off %, source table, product table; match the look of `app/admin/waitlist/page.tsx`. Add nav link.
- [ ] **Step 5: Privacy** line: "We store a random anonymous ID and the link you arrived from to count visits and steps. No personal details are attached. Clearing your browser's site data removes the ID."
- [ ] **Step 6: Run** `npm.cmd run test:unit`, `npm.cmd run build`, ESLint on changed files, then with the dev server up `node scripts/marketplace-smoke.mjs http://127.0.0.1:3000`. Expected: pass (smoke uses fixtures only, so real backend/payment is not verified).

### Task 5: End-to-end check and report

- [ ] Start backend and frontend locally; with the browser pane, check as a customer: add product A to cart, Buy Now product B, confirm checkout shows only B, the cart still shows A, and `/admin/funnel` shows the events. Report what was verified against fixtures vs a real service, and anything not run.
- [ ] Review the working-tree diff; do not commit unless asked.
