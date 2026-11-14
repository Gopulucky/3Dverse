# Customer launch guide

This is an operator guide for the India/INR launch. Local fixture checks do not activate external accounts or certify a production deployment.

## 1. Firebase authentication

1. Create a Firebase project in the [Firebase console](https://console.firebase.google.com/). Register a Web app.
2. In Authentication, enable **Email/Password** and **Google**. Configure the Google support email and add the actual frontend domains under authorized domains. Include localhost explicitly for local testing when needed.
3. Copy the web app's public configuration into the frontend build environment:

   ```dotenv
   NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
   ```

4. Set backend `FIREBASE_PROJECT_ID` to the same project. Provide Application Default Credentials through workload identity, or mount a server-only service-account file and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. For local development, the backend also reads this path from `backend/.env`; on Render use a Secret File and `/etc/secrets/firebase-admin.json`. Use the minimum permissions necessary to verify tokens and inspect/revoke users. Never put an Admin key in `NEXT_PUBLIC_*`, the repository, browser code or chat.
5. Rebuild the frontend after changing public environment values; restart the backend after configuring credentials. Do not set `FIREBASE_AUTH_EMULATOR_HOST` in production—the app rejects that configuration.
6. Configure the Firebase verification/password-reset email templates, sender and authorized action domain. Test Google popup sign-in, email registration/verification, password reset, sign-out, expired token refresh, disabled-account rejection and mobile browsers on the deployed domain.

The Firebase Admin SDK verifies token signatures, audience, issuer, expiry and revocation. The marketplace resolves the verified Firebase UID to its own user row; client claims never select an admin or partner role. New accounts begin as customers. Orders and products remain in PostgreSQL.

Existing password accounts are retained. They can use **Use my previous 3DVerse sign-in** while migrating. An existing email is never silently attached to a new Firebase identity. Linking requires a verified Firebase email and the previous marketplace password. Linking preserves the user ID and orders, increments the old token version, and disables old local-password login/reset for that linked account. A customer who lost the previous password must recover the previous account before linking; use the previous-account reset path. Do not manually link accounts using email coincidence alone.

Without Firebase configuration, existing email authentication remains available and Google is visibly unavailable. No Firebase project has been created by the code changes.

Official references: [Web authentication](https://firebase.google.com/docs/auth/web/start), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Admin setup](https://firebase.google.com/docs/admin/setup), [ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## 2. Database and prices

Back up PostgreSQL and private object storage before deploying schema changes. Rehearse restore and migration in staging. Run `alembic upgrade head` using the intended database credentials; verify the resulting revision before serving the new frontend.

Migration `d9f2a7b6c104` labels existing product/order amounts **USD**, then defaults new records to **INR**. It adds Firebase UIDs, immutable payment amounts, payment event records, delivery evidence and parcel details. It does not convert money or infer delivery dates. Check for duplicate existing payment-intent IDs before applying the new unique constraint.

Creators must explicitly reprice old listings in INR, including their print price. New checkout rejects legacy USD listings. Historic order pages/receipts continue to show their original currency. Finance, collaboration and commission flows have legacy currency assumptions: do not mix USD and INR in operational reporting or payouts without a separate currency-aware accounting review.

Do not roll back by simply dropping currency columns after INR sales: that would erase the meaning of stored prices. Preserve a database snapshot and plan any rollback around financial records.

## 3. Payments

Checkout uses **Razorpay** (Orders API + Standard Checkout). The business must independently complete Razorpay KYC/activation for its Indian operation and confirm which payment methods are enabled on its account. Do not substitute test credentials for a live merchant setup.

**Setup, in order**

1. In the Razorpay Dashboard, in **Test mode**, generate API keys (Account & Settings → API keys). Set backend `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET`. The frontend needs **no** payment variable: the API hands the browser only the public key id for each order.
2. Dashboard → Webhooks → Add. URL: **`https://<your-api-host>/api/checkout/webhook`**. Active events: `payment.captured`, `order.paid`, `payment.failed`. Type a long random secret and set it as backend `RAZORPAY_WEBHOOK_SECRET` (it is *not* the API key secret). Razorpay can also deliver webhooks for a Payment Page (e.g. `/support`); events for payments that are not 3DVerse orders are acknowledged and ignored.
3. Settings → Payment capture: keep **automatic capture** on. Only captured payments mark an order paid; authorised-but-uncaptured payments are auto-refunded by Razorpay after its window.
4. Go live only after KYC: swap in `rzp_live_…` keys and register a **live-mode** webhook with its own secret. The backend refuses test keys when `ENVIRONMENT=production` and live keys otherwise. `GET /api/checkout/status` reports whether checkout is currently available.

**How an order is paid.** Checkout persists a buyer-owned order snapshot (amount in paise, currency, stock reserved) *before* contacting Razorpay, then creates a Razorpay order for exactly that stored amount. The customer pays in Razorpay's window. An order becomes `paid` only through (a) the signed webhook or (b) `POST /api/checkout/verify`, which checks Checkout.js's HMAC signature and then reads the payment from Razorpay's API. Either way the payment must belong to the stored Razorpay order, with the full stored amount and currency, and be `captured`. A browser callback alone never grants paid status. Webhook replays are recorded safely (`x-razorpay-event-id`). Resuming or cancelling an order also re-checks Razorpay, so a lost webhook self-heals.

**Cart, hold and Orders.** The cart is a list that reserves nothing. Pressing "Continue to payment" starts a **checkout hold**: stock is reserved for `CHECKOUT_HOLD_MINUTES` (default 15) and the cart is left as it is; only the quantities actually paid for are removed once payment is confirmed (anything added meanwhile stays). A customer has one live hold: starting checkout again with the same cart reuses it, a changed cart replaces it (refused while a payment is in flight). An unpaid hold is **not an order**: `GET /api/orders/` lists only orders that were paid or have progressed, and a live hold shows as a "complete your payment, N min left" banner on Cart and Orders (`GET /api/checkout/hold`). Cart lines that cannot be bought ("Out of stock", "Only 2 left", unpublished, wrong currency) stay visible with the reason, are left out of the total and block checkout until removed.

**Expiry needs no worker.** Production runs no Celery worker or cron, so holds are expired inside requests: when the customer starts a checkout, when anyone needs stock on the same products, and when a stale hold is resumed. Before releasing a hold Razorpay is asked: a captured payment settles the order instead, an authorised one or an unreachable Razorpay leaves it for a later attempt. Releasing returns the stock and the coupon use. The Celery task `expire_pending_orders` (if you ever run a worker) applies the same rules.

Razorpay orders cannot be cancelled, so cancelling releases stock locally after confirming no payment is captured or in flight; if money still arrives for a cancelled or expired order it is **refunded in full automatically** (and recorded in the order's status history). A persisted `payment_preparing` marker blocks local cancellation when creation may have succeeded without a saved Razorpay order id; on retry the order is looked up by its receipt (`3dv-<order id>`) before a new one is created.

**UPI first, and phones.** The Razorpay window lists UPI first, then cards, netbanking and wallets (methods still have to be enabled in the Razorpay dashboard). On phones the customer often leaves the browser for a UPI app, so the page's JavaScript callback may never run: phones use Razorpay's redirect mode, which POSTs the signed result to `POST /api/checkout/callback`. That endpoint verifies the signature, reads the payment from Razorpay, and redirects to the site's `/checkout/return` page, which polls the order until it is confirmed. If Razorpay asks you to allow-list the callback domain, add your API host. The signed webhook remains the backstop for every path. Set `FRONTEND_URL` on the API so the redirect lands on your site.

Existing databases: migration `e5b7c2d9a418` (run automatically by the Render start command) adds `razorpay_order_id`, `razorpay_payment_id` and `coupon_id` and leaves the old `stripe_payment_intent_id` column in place, unused. Any unpaid order that only has a Stripe id is given a fresh Razorpay order when the customer resumes it.

The legacy `/api/orders/confirm` shortcut is retired. Production commission/design-fee/collaboration payment shortcuts are blocked. `ALLOW_MOCK_PAYMENTS` is false by default and is never a checkout fallback.

**Refund settlement and creator/partner payouts are not automated.** The admin app refuses to mark an unsupported refund complete. Establish an audited payment-operator workflow with transaction evidence, customer communications and accounting reconciliation before accepting sales. Do not tell a customer money has been refunded based on an internal status label.

Stage and verify a real provider test transaction, signed webhook delivery, duplicate/out-of-order events, interrupted checkout, cancellation and refund reconciliation. Then separately verify the live deployment with the merchant operator. [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/). The repository's tests and `frontend/scripts/checkout-razorpay-smoke.mjs` use a fake Razorpay and a stub Checkout.js: they do **not** prove that a real Razorpay payment, webhook delivery or refund works, and the Content-Security-Policy entries for Razorpay (`checkout.razorpay.com`, `api.razorpay.com`) should be confirmed once in a real browser with test keys.

## 4. Delivery and returns

Set `CHECKOUT_SHIPPING_INR` to the actual standard delivery fee after validating service areas and operating costs. No physical checkout is offered when the fee is unset. Digital orders have no delivery fee. Checkout currently serves Indian addresses and validates name, phone, state and PIN code.

Configure the Shiprocket credentials and pickup location shown in the backend environment example. The partner must record the actual parcel weight/dimensions and customer contact information. Carrier calls have timeouts; production cannot generate mock tracking details.

The production sequence is queued → printing → quality check → packed → shipped → delivered. The app requires confirmed shipment/tracking evidence before later states, and records delivery time once. A provider failure must not appear as successful dispatch.

If creating a shipment times out, the request may have been accepted. A persisted `shipment_creation_started` history entry prevents blind duplicate creation. Reconcile using the stable 3DVerse order ID in Shiprocket. Restore confirmed carrier IDs through audited maintenance if the shipment exists. Clear the attempt marker only after proving the carrier did not create it. AWB-only failures retry the already confirmed shipment. There is no public reconciliation endpoint.

Return windows start from the recorded delivery time: 48 hours for a defect report and seven days for eligible returns. Digital items are excluded from physical return requests. Legacy delivered orders without reliable timestamps remain closed until an operator backfills evidence; do not invent a date to open or close a claim. Review the customer-facing policy and actual support procedure before launch.

## 5. Storage, email and operations

- Keep paid models/design submissions in the private object bucket. Use a separate public image bucket/base URL. Configure the same storage access on API and worker services. Production upload failures return an error instead of falling back to ephemeral local disk.
- Set `FRONTEND_URL`, SMTP settings and `EMAIL_FROM` for legacy recovery and platform emails. Firebase sends its own authentication emails. Verify deliverability and avoid logging email tokens in production.
- Run the Celery worker and scheduler with Redis as configured by `render.yaml`. Optional Sentry monitoring uses `SENTRY_DSN`; verify an actual error event before relying on alerts. `/health` is a process check, not proof that every dependency works.
- Configure the actual frontend CORS origin, strong `SECRET_KEY`, HTTPS, restricted object access, backups/retention and a monitored support channel. Review all placeholder business/legal/contact copy. Repository MIT licensing does not license customer uploads or creator designs.
- Review failed payments, missing webhook events, shipping failures, pending stock reservations, support requests and backups regularly. Do not treat fixture tests or an empty dashboard as evidence that operations are healthy.

## 6. Optional startup support

The public `/support` page offers voluntary, one-time support for maintenance and growth. Contributions do not create marketplace orders, products, shares or account privileges. They are not advertised as charitable tax-deductible donations.

1. Set up a merchant-hosted payment page with a provider that supports your Indian business and this use. The repository does not create or activate a merchant account. [Razorpay Payment Pages](https://razorpay.com/docs/payments/payment-pages/) is one hosted-page option; verify eligibility with the provider.
2. Configure the actual business/recipient name, INR currency, one-time amount options, contact/refund information and receipts on that page. Confirm those details yourself before publishing the link.
3. In **Vercel → frontend project → Settings → Environment Variables**, add `SUPPORT_PAYMENT_URL` with the full live **HTTPS** page URL. This is a destination, not an API key. Do not add provider secret keys or service-account credentials. Select the intended deployment environments and redeploy. Locally, use `frontend/.env.local` and restart the server.
4. Open `/support` as a signed-out visitor and follow **Make a contribution**. Verify the provider's recipient, INR amount and one-time payment before completing a real operator-approved transaction. Check its receipt and support/refund process. A return URL or browser message is never proof of a completed transfer.
5. Reconcile contributions and any refunds using the provider dashboard and business accounting. There is no contribution ledger, webhook, subscription or automated refund in 3DVerse. Store orders and their Razorpay webhooks remain separate.

Missing or invalid configuration removes the payment action and leaves an honest unavailable message. To stop taking contributions, remove the environment value and redeploy. Build/browser fixtures test the UI and URL handling, not a live transfer.

## Verification limits

Backend tests exercise security/business boundaries and isolated persistence fixtures; they do not apply PostgreSQL migrations to a live production database. Browser scripts intercept API responses and bypass CSP in isolated fixture contexts so local HTTP mocks can run against a production build; they do not verify deployed CSP or networking. CI/build checks do not verify Firebase console settings, merchant access, payouts, SMTP delivery, private cloud storage or a carrier account. Record staging and live-provider evidence separately before opening the store.
