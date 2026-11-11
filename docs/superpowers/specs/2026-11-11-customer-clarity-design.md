# Customer clarity — storefront speaks to buyers only

Status: draft for review · 2026-11-11 · Sub-project 1 of 3 (then catalogue, then partner hub)

## Goal

A customer arriving at 3DVerse should understand, without effort, the two things they can buy:

1. **A finished 3D-printed product, delivered in India** — no printer needed.
2. **A digital model file** to print on their own printer.

Creator Studio and the Print Partner Hub are the supply side of the ecosystem. Customers don't need them, so the customer storefront stops advertising them. One quiet door stays open for people who want to sell or print.

## What customers see today (findings)

- The home hero, "How shopping works", product cards (format badges) and site metadata (`BRAND.positioning`, `BRAND.oneLiner`) are **already buyer-facing**. They stay.
- The account-menu portal switcher is **already role-gated** (`allowed` per role), so customers never see Creator Studio or Partner Hub there. It stays.
- Supply-side leaks:
  - **Footer:** "For Creators" column (Creator Dashboard, Upload a Design, Become a Creator) and "For Print Partners" column (Partner Console, Become a Partner).
  - **Account menu:** a highlighted "Sell with 3DVerse" item for every non-creator, including customers (`navbar.tsx`, `!isCreator`).
  - **Home page:** the closing "Make or print designs? Bring your work to the marketplace." section (`home-content.tsx`, `.store-seller-note`).
  - **Tagline:** "Upload Once. Sell Forever. Print Anywhere." is a creator pitch. It is shown in the footer and as the headline of the social share image (`opengraph-image.tsx`).

## Changes

### Footer (`components/layout/footer.tsx`)
- Remove the "For Creators" and "For Print Partners" columns.
- Rename "For Customers" to **"Shop"** (links unchanged: Browse all products, Printed products, Digital models, Your orders).
- In "Company", add one link: **"Sell on 3DVerse"** → `/sell`. This is the single public supply-side entry.
- Grid becomes brand + Shop + Company (`md:grid-cols-3` layout instead of 5).
- Brand block shows the new buyer tagline (below).

### Account menu (`components/layout/navbar.tsx`)
- Remove the "Sell with 3DVerse" menu item. Signed-in customers reach `/sell` through the footer like everyone else.
- Portal switching, role-gated menus and the creator/partner mobile links stay as they are.

### Home page (`components/marketplace/home-content.tsx`)
- Remove the "Make or print designs?" section and its now-unused `.store-seller-note` CSS.

### Brand copy (`lib/brand.ts`)
- `BRAND.tagline` becomes buyer-facing: **"Finished prints, delivered. Digital models, ready to print."**
- The creator pitch moves to a new `BRAND.sellerTagline` = "Upload Once. Sell Forever. Print Anywhere." It is shown on `/sell` under the "Sell with 3DVerse" heading, so the creator promise isn't lost.
- The social share image uses the new buyer tagline automatically (it reads `BRAND.tagline`).

### Kept on purpose
- `/sell` page, its heading ("Sell with 3DVerse", used by `customer-options-smoke.mjs`), the creator setup and the partner section.
- All creator, partner and admin routes and role gates.
- The register page's small "Want to sell your designs?" link. Someone deciding to sell often starts at sign-up.
- The About page, which tells the company/ecosystem story (mission, audiences). It is the right place for that story, not the shopping path.
- `sitemap.ts` is unchanged. Note: it does not currently list `/sell`, so seller discovery through search is weak; adding it is a separate decision for you.

## Non-goals
- No route removals, redirects or role changes.
- No change to product data, prices, checkout or the partner hub (sub-projects 2 and 3).
- No visual redesign: existing tokens, type and layout only (`frontend/design.md`).

## Verification
- `npm run build`, ESLint on changed files, `npm run lint:critical`, `npm run test:unit`.
- Smoke on a production build: `marketplace-smoke`, `customer-options-smoke` (which visits `/sell`), `auth-smoke`, `support-smoke`.
- Browser check at 375 px and 1280 px, signed out and signed in as a customer:
  - the footer has no creator/partner columns and does have "Sell on 3DVerse"
  - the account menu has no "Sell with 3DVerse"
  - the home page has no seller section
  - no horizontal overflow in the 3-column footer
- Screenshot of the footer at both widths.

## Risks
| Risk | Mitigation |
|---|---|
| Creators who used footer links to reach their dashboard | They have the role-gated portal switcher in the account menu |
| Fewer people discover selling | `/sell` stays linked from the footer and the register page. (The About page and sitemap do not link it today.) |
| A smoke script expects removed copy | Checked: only `/sell`'s heading is referenced, and it stays |
