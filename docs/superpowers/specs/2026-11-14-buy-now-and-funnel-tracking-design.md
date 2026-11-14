# Buy Now and funnel tracking: design

Approved by the owner in conversation on 2026-11-14 ("Yes, go"), after the owner chose funnel tracking only and dropped the price-randomised "Reserve" button and the choice tests until customers arrive.

## Intent
1. **Buy Now charged the whole cart.** It added the product to the cart and opened `/checkout`, and `payments.prepare_order` builds an order from every cart line. A shopper buying one product saw and paid for everything they had ever carted.
2. **The business has no customers and no behavioural data.** Only Vercel page views exist. Pre-launch practice (see below) says stated answers are weak evidence and behaviour is strong, so the first step is to record what visitors actually do, by channel.

Evidence for 2: pre-order/waitlist-conversion tests, small paid-ad probes and competitor-proxy research are the common D2C methods; surveys measure stated, not revealed, preference. Funnel tracking is the instrument that makes the ad and WhatsApp/Instagram tests measurable once traffic arrives.

## Goals
- Buy Now sends one product (id, purchase option, quantity 1, chosen print options) straight to checkout. The cart is not read, changed or emptied.
- A direct order never removes anything from the cart when it is paid, even if the same product is also in the cart.
- Anonymous visitor ID and first-touch source (`?src=`, `utm_source`/`utm_medium`/`utm_campaign`) are recorded with each event.
- Events: `landing`, `product_view`, `viewer_opened`, `add_to_cart`, `buy_now`, `checkout_started`, `payment_opened`, `waitlist_joined`, and `paid` (recorded on the server when payment is verified, never by the browser).
- Admin page: funnel counts and step-to-step drop-off, by source and by product.

## Non-goals
Price randomisation, "Reserve" button, choice tests, surveys, deposits/pre-orders, third-party analytics tools, user-level profiles, retention/cohort analysis.

## Anti-goals
Nothing here may put a direct order at risk of charging the wrong items. Tracking must never block or slow a page, never hold personal data (no email, name, phone, address), and never let a browser claim a purchase.

## Constraints
- Next.js in this repo has breaking changes; read `node_modules/next/dist/docs/` before frontend work.
- Backend tests run offline on SQLite (`payment_db` fixture in `tests/test_payments.py`).
- UI flow state lives in `frontend/src/lib/machines/` (pure reducers, `data-flow`/`data-state` attributes).
- India, INR; DPDP-style honesty: the privacy page must say what is recorded.

## Approaches
Buy Now:
- A. Add the product to the cart, then check out only that line. Rejected: still mutates the cart, merges with an existing identical line, and needs "which lines" bookkeeping.
- B. **Chosen.** Checkout request carries an optional `direct_item`; the server prices it with the same `price_line` as a cart line and skips the cart. Direct order lines are marked `buy_now` in `selected_config`, so no migration is needed and `consume_cart` can skip them.

Tracking:
- A. Third-party tool (PostHog, GA). Rejected for now: external data sharing and consent surface for a site with no traffic yet.
- B. **Chosen.** One `funnel_events` table plus a small public endpoint; the owner owns the data and can export it.

## Design
**Buy Now (backend).** `CheckoutRequest.direct_item = {product_id, quantity 1..100, purchase_type digital|physical, selected_config?}`. When present, `prepare_order` skips the cart, prices the single line via `price_line`, and stamps `buy_now: true` on the order line. `hold_matches` compares the flag so a live cart hold is never reused for a direct purchase or the reverse. `consume_cart` skips `buy_now` lines. The idempotency fingerprint already covers the whole request.

**Buy Now (frontend).** The product page stores the single item in `sessionStorage` (`buy-now-<userId>`), then goes to `/checkout?buy=now`. The checkout page reads the stored item instead of the cart for the review list and for the "physical or digital" decision, shows "Buying now: 1 item", and links "Back to the product" instead of "Back to cart". The cart count and cart contents are untouched.

**Tracking (backend).** Table `funnel_events(id, anon_id, event, product_id nullable, source nullable, medium, campaign, path, created_at)`; migration with Alembic. `POST /api/events` accepts a batch (max 20), only whitelisted event names and well-formed IDs, rate-limited per IP, always 204. `paid` is written inside the payment-verified path. `GET /api/events/admin/funnel` (admin only) returns counts and drop-offs per step, by source and by product, plus `waitlist_joined`.

**Tracking (frontend).** `lib/track.ts`: `anon_id` in `localStorage` (random, not tied to an account), first-touch source stored in `sessionStorage`/`localStorage` on first landing, `track(event, {productId})` that never throws and uses `sendBeacon`/`fetch keepalive`. Wired to: landing (once per session), product view, 3D viewer opened, add to cart, Buy Now, checkout started (checkout page ready with items), payment opened (Razorpay window opens), waitlist joined. Admin page `/admin/funnel` in the admin shell.

**Privacy.** The privacy page gets a plain-language line: an anonymous ID and the link source are stored to count visits and steps; no personal details are attached; the ID can be cleared by clearing site data.

## Rulings made while building
- **`checkout_started` is recorded by the server, not the browser.** The checkout request carries an anonymous `visitor` (id and source). The server stores `checkout_started` with the order id, and `paid` later copies that visitor's source, so a sale is credited to a channel without trusting the browser. `visitor` is excluded from the idempotency fingerprint.
- **`paid` has no per-product count.** An order can hold several products; the product table shows views, cart adds and Buy Now presses.
- **`viewer_opened` fires on the first pointer-down on the 3D viewer**, not on render, so it measures real use.
- **The `buy_now` marker is stripped from order APIs** (`public_config`), because creator and partner pages print every option stored on an order line.
- **Existing migration-head test updated** (`test_partner_migration.py`) to expect the new revision as head.
- **Tracking writes are isolated from payments:** `paid` is written inside a savepoint, `checkout_started` in a separate commit, and the public events endpoint always answers 204.

## Left to the builder
Exact column sizes, copy, chart styling (use the existing admin look), and the retention period (default: keep, review before launch).
