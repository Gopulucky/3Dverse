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

The repository retains Stripe PaymentIntents. The business must independently confirm merchant eligibility, activation and supported payment methods for its Indian operation. Do not substitute test credentials for a live merchant setup.

Configure backend `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and frontend `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Development accepts Stripe test keys; production requires live keys and live webhook events. Register the webhook URL **`/api/checkout/webhook`** on the backend for `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled`. Use the exact signing secret for that endpoint.

Checkout persists a buyer-owned order snapshot before contacting Stripe. Prices are rounded into integer minor units; the stored amount and currency are authoritative. Retrying the same checkout key reuses its snapshot/intent. A signed webhook must match the stored intent, order/customer metadata, amount, currency and full received amount before marking the order paid. A client redirect does not grant paid status. Duplicate events are recorded safely.

Preparing an order moves its items out of the cart and reserves stock. Customers can resume a saved pending payment from Orders. Cancellation releases stock only after confirming gateway cancellation, or before any provider creation attempt. A persisted `payment_preparing` marker blocks local cancellation when creation may have succeeded without a saved intent ID. Reconcile ambiguous/abandoned attempts, reserved stock and coupon usage as an operator until automated expiry is implemented. Stripe can prune idempotency keys after its retention period, so uncertain old attempts need reconciliation rather than a blind new payment.

The legacy `/api/orders/confirm` shortcut is retired. Production commission/design-fee/collaboration payment shortcuts are blocked. `ALLOW_MOCK_PAYMENTS` is false by default and is never a checkout fallback.

**Refund settlement and creator/partner payouts are not automated.** The admin app refuses to mark an unsupported refund complete. Establish an audited payment-operator workflow with transaction evidence, customer communications and accounting reconciliation before accepting sales. Do not tell a customer money has been refunded based on an internal status label.

Stage and verify a real provider test transaction, signed webhook delivery, duplicate/out-of-order events, interrupted checkout, cancellation and refund reconciliation. Then separately verify the live deployment with the merchant operator. [Stripe webhook documentation](https://docs.stripe.com/webhooks).

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

## Verification limits

Backend tests exercise security/business boundaries and isolated persistence fixtures; they do not apply PostgreSQL migrations to a live production database. Browser scripts intercept API responses and bypass CSP in isolated fixture contexts so local HTTP mocks can run against a production build; they do not verify deployed CSP or networking. CI/build checks do not verify Firebase console settings, merchant access, payouts, SMTP delivery, private cloud storage or a carrier account. Record staging and live-provider evidence separately before opening the store.
