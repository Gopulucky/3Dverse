# Checkout hold and UPI-first payment: design

Approved by the owner in conversation on 2026-11-14 ("clear all our doubts and then build our website", after choosing option B).

## Intent
Unpaid checkout attempts were showing up as orders, the cart was emptied the moment someone pressed "Continue to payment", and Indian customers (who mostly pay by UPI) were shown a generic payment window. Behave like mainstream Indian marketplaces: a cart reserves nothing, an order exists in the customer's eyes only once paid, payment starts with UPI.

## What was learned (evidence)
- Amazon.in cart page: "a temporary place to store a list of your items", latest price shown; guest carts allowed; sign-in only at "Proceed to Buy". Flipkart: login needed even to see the cart; out-of-stock lines stay in the cart labelled "Out Of Stock" and are left out of the total; Orders filters are On the way / Delivered / Cancelled / Returned only (no awaiting-payment status). Their internals are not published; this is observed behaviour.
- Render production has two free web services and no worker or cron, so the existing Celery "expire pending orders" task has never run. Expiry must therefore happen inside requests.
- Razorpay: orders never expire on their own; Checkout has a `timeout` option; `callback_url` mode POSTs `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` to the server and bypasses the browser handler; UPI intent has no redirect on completion, so server-side confirmation and webhooks are the reliable path; UPI Collect is being deprecated; `config.display` blocks with `sequence` put UPI first.

## Goals
1. Cart is kept until payment is confirmed; only the paid quantities are removed from it.
2. A started checkout is a 15-minute **hold** (stock reserved). One live hold per customer: re-pressing Pay with an unchanged cart reuses it, a changed cart replaces it (refused while a payment is in flight).
3. Holds expire on demand (no Celery): at the customer's next checkout, when any checkout needs stock on the same products, and in the existing Celery task. Before releasing, Razorpay is asked: captured means settle instead, authorised means leave it, unreachable means retry later.
4. The Orders list shows only orders that were paid or have progressed. A live hold shows as a banner ("complete your payment, N min left") on the cart and Orders pages.
5. Coupon use taken by a hold is returned when the hold is cancelled or expires.
6. Cart lines say when they are unavailable (and why); checkout is blocked until they are removed.
7. Razorpay window: UPI block first, then cards, netbanking, wallets. On phones use redirect mode (`callback_url`), so a payment finished inside a UPI app still lands on a server endpoint that verifies it and sends the customer to a "confirming your payment" page.

## Non-goals
Guest carts, "Save for later", per-line "Buy now", free-delivery nudge, a separate checkout-session table (rejected: bigger money-path rewrite), automatic Razorpay-side order expiry, COD.

## Anti-goals
Never mark paid on a browser signal alone; never release stock while money may be moving; never let a late payment on an expired hold be kept without an order (existing auto-refund covers it).

## Decisions made by the builder (flag if you disagree)
Hold length 15 minutes (`CHECKOUT_HOLD_MINUTES`); phones detected from the user agent; unavailable lines block checkout rather than being silently dropped; migration `e5b7c2d9a418` (not yet deployed) is extended with `orders.coupon_id`.

## Setup note for the owner
Razorpay may require the callback URL's domain to be allow-listed for redirect mode: add the API host (`https://<api-host>/api/checkout/callback`) in the dashboard if payments on phones fail to return.
