# 3DVerse

**Buy a finished 3D-printed product, or download a 3D file to print yourself.**

3DVerse is a customer marketplace for independent 3D creators. Customers can browse without an account, choose a printed product or a digital download, and use their account to track orders and access purchased files. Creators manage their listings; print partners handle production and delivery.

The first launch targets **India, with prices in INR**. The application is under active development. Google sign-in, payments and shipping require the operator setup below before they can serve real customers.

## The customer journey

1. Choose **printed products** if you want something delivered. You do not need a 3D printer.
2. Choose **3D files** if you have access to a printer and want a digital download.
3. Review the listing, select the purchase option, and add it to your cart.
4. Sign in when you are ready to order. Google and email sign-in use Firebase Auth when configured; existing password accounts have a migration path.
5. Payment confirmation comes from the provider. Paid digital files are accessed through authenticated downloads; physical orders show production and delivery progress.

## What is implemented

| Area | Behaviour |
| --- | --- |
| Storefront | Clear print/file entry points, search, format filters, sorting, pagination, and distinct loading, empty and error states |
| Accounts | Customer-first registration, Firebase Google/email integration, server-owned roles, and explicit linking for existing accounts |
| Purchasing | Separate digital and physical options; explicit currency; an order snapshot saved before a Stripe payment attempt |
| Confirmation | Signed, replay-safe webhooks validate the order, customer, intent, amount and currency before granting payment status |
| Fulfilment | Guarded production status transitions, parcel/contact validation, and shipping failures that remain visible |
| Files | Authenticated access to purchased/private files, with a corrected partner identity check |
| Operations | Creator and partner portals, PostgreSQL migrations, Redis/Celery jobs, and CI checks |

## Before taking customer payments

This repository is not evidence of a live merchant, shipping or Firebase account. Follow the [launch guide](docs/customer-launch.md) before opening checkout to customers.

- Create a Firebase project, enable Google and email/password authentication, add the web configuration, and configure server-only Admin credentials.
- Back up the database and run migrations. Existing USD prices stay USD; creators must explicitly enter INR prices. No automatic currency conversion occurs.
- Activate and verify the chosen merchant account for the Indian business. The current integration is Stripe; confirm your business can use it before relying on it.
- Configure signed webhooks, the INR shipping fee, Shiprocket, private/public object storage, and email delivery. Verify the full flow in the deployed environment.
- Refund settlement and creator/partner payouts remain operator work. The app blocks unsupported refund completion and production commission/collaboration payment shortcuts.
- Publish accurate business, contact, privacy, delivery and refund information. Complete a real test order, delivery, cancellation/refund procedure and backup restore drill.

## Run locally

Requirements: Node.js 22, Python 3.13, Docker Compose, and the services configured in the example environment files. Use a Python virtual environment so project dependencies remain isolated.

```bash
docker compose up -d
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. Keep the local database values unless you intentionally configure another database. Never commit credentials.

```bash
cd backend
python -m venv venv
# macOS/Linux: source venv/bin/activate
# Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

In a separate terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Development API documentation is at `http://127.0.0.1:8000/docs`. Start the Celery worker for background analysis and preview jobs:

```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info
```

Windows users can use a Linux container or WSL for Celery. Optional scripts in `backend/scripts/` seed demonstration data or backfill embeddings. Run them only against an intended development database; demonstration accounts and data are not production inventory.

## Verify changes

```bash
cd backend
python -m pytest -q -p no:cacheprovider
```

```bash
cd frontend
node scripts/currency-test.mjs
node scripts/purchase-options-test.mjs
npx tsc --noEmit
npm run build
```

With the frontend running, the Playwright fixture checks cover browsing, purchase choices, sign-in clarity and the partner queue:

```bash
node scripts/marketplace-smoke.mjs http://127.0.0.1:3000
node scripts/customer-options-smoke.mjs http://127.0.0.1:3000
node scripts/auth-smoke.mjs http://127.0.0.1:3000
node scripts/partner-smoke.mjs http://127.0.0.1:3000
```

These scripts intercept API responses. They do not prove that a deployed backend, Firebase project, card payment or carrier works. They use installed Microsoft Edge by default; set `BROWSER_CHANNEL=chromium` after installing Playwright Chromium on Linux. See CI for the automated commands. Existing frontend lint debt is tracked separately from the critical-flow lint checks.

## Project structure

```text
frontend/     Next.js, React, TypeScript and Tailwind customer/operations UI
backend/      FastAPI, SQLAlchemy, Alembic, Stripe, Firebase Admin and Celery
docs/         Launch and implementation notes
.github/      Continuous integration
```

PostgreSQL stores marketplace accounts, products and orders. Firebase handles authentication only; it does not replace the marketplace database. Redis supports cache and background jobs. Paid files belong in private object storage, separate from public catalogue images.

## Contributing and security

Useful contributions improve customer understanding, accessibility, purchasing reliability or operations. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [SECURITY.md](SECURITY.md) for private vulnerability reporting. A useful product and honest documentation can earn interest; no repository change can guarantee GitHub Trending placement.

## License

Project source is available under the [MIT License](LICENSE). Third-party dependencies keep their own licenses. Customer uploads, creator designs and trademarks are not granted a license by this repository.
