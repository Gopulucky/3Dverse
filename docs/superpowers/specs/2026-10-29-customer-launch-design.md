# 3DVerse customer launch design

User direction: 3DVerse is a customer-facing startup, initially serving India
in INR. Friends found the opening confusing and did not understand the site's
purpose. Improve the actual customer experience and README; do not position
the product as a developer framework. The user selected MIT for the repository.

## Product decisions

- The first screen must explain that customers can buy a finished 3D print or
  download a digital model for their own printer. The existing seller tagline
  can stay in brand material but must not lead the customer homepage.
- Offer two functional shopping paths: printed products and downloadable models.
  Explain digital files, delivered physical prints and the purchase sequence in
  plain language. Search, prices, fulfilment labels and empty/error states must
  reinforce the same meaning. No fake proof, UPI claims, delivery promises or stock.
- Keep the established fonts, violet/ember/moss palette and existing routes.
- INR is the first-launch currency. Preserve legacy USD prices explicitly;
  never relabel or silently exchange them. Legacy listings must be repriced
  intentionally before an INR checkout can accept them.
- Use the existing Stripe integration with order-bound payment intents and
  signed, idempotent webhooks. No customer-controlled paid state in production.
  Do not invent gateway access or activate live charging without real merchant
  configuration. Mock commission/collaboration payments must be disabled in production.
- Fix confirmed private-file authorization and reject invalid fulfilment transitions.
  Production file storage and shipping must report errors rather than silently
  fabricate success. Add delivery timestamps for correctly anchored return windows.
- README explains the customer product, current capabilities, screenshots/demo
  limitations, setup, checks, required launch configuration and an honest roadmap.
  Add MIT and practical security/launch guidance. No promise of GitHub Trending.

## Approach and scope

Build on the existing Next.js/FastAPI application, rather than introducing a new
stack or replacing all roles. Clarify shopping first, complete and guard the
existing backend money flow, then strengthen verification and documentation.
Avoid cosmetic-only marketing that conceals unfinished provider integrations.
External merchant activation, shipping accounts, real inventory repricing,
seller payout policy and live transaction verification remain operator work.

## Acceptance

The homepage identifies the product and two buyer choices within the first screen;
both choices filter real API results; digital and physical meanings are visible.
Prices carry their true currencies; production payment/identity/shipping guards
have regression tests. Backend tests, frontend build and meaningful customer
browser checks run before completion. Unrelated local deletions are preserved.
