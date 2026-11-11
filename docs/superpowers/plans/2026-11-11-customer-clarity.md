# Customer Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer storefront advertise only buying (finished prints delivered in India, digital models), keeping one quiet "Sell on 3DVerse" entry.

**Architecture:** Copy and navigation edits only, in four existing files plus `/sell`. A unit test pins the brand copy; regression assertions are added to the existing storefront smoke so the removed entry points can't silently return.

**Tech Stack:** Next 16 / React 19, `node:test` + `scripts/load-ts.mjs`, Playwright smoke (`marketplace-smoke.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-11-customer-clarity-design.md`

## Global Constraints

- No route, role or API change. `/sell` heading stays exactly "Sell with 3DVerse".
- Existing tokens/classes only (`frontend/design.md`); no new colours or fonts.
- Do not touch `frontend/AGENTS.md`, `docs/brand/*`, `.hallmark/*`, `sample_images/` (unrelated user changes).
- Exact copy: buyer tagline **"Finished prints, delivered. Digital models, ready to print."**; seller tagline **"Upload Once. Sell Forever. Print Anywhere."**; footer link label **"Sell on 3DVerse"**; footer column **"Shop"**.

## Review Focus

1. **Signed-in creator or partner viewing the storefront.** They must still reach their portal through the account-menu switcher after the footer links go. Test: Task 2 smoke step (portal switcher present for a creator fixture).
2. **Footer at 320–375 px.** The 3-column grid must not overflow. Test: covered by the existing marketplace-smoke overflow check at 320/375 px, plus a screenshot.
3. **Social share image.** It reads `BRAND.tagline`; the new copy must fit at 54 px within 900 px. Check: build renders `/opengraph-image` without error; view it once.

---

### Task 1: Brand copy

**Files:** Modify `frontend/src/lib/brand.ts`, `frontend/src/app/sell/page.tsx`; Create `frontend/scripts/machines/brand-copy.test.mjs`.

**Interfaces:** Produces `BRAND.tagline` (buyer copy) and `BRAND.sellerTagline` (seller copy).

- [ ] **Step 1: Failing test** `brand-copy.test.mjs`. Use `loadTs('src/lib/brand.ts')`:
  - assert `BRAND.tagline === 'Finished prints, delivered. Digital models, ready to print.'`
  - assert `BRAND.sellerTagline === 'Upload Once. Sell Forever. Print Anywhere.'`
- [ ] **Step 2:** `node --test scripts/machines/brand-copy.test.mjs` → FAIL (tagline mismatch).
- [ ] **Step 3:** Update `brand.ts` per the Global Constraints copy.
- [ ] **Step 4:** On `/sell`, render `BRAND.sellerTagline` as a short line directly under the "Sell with 3DVerse" `<h1>`. The heading text is unchanged.
- [ ] **Step 5:** Run the test → PASS; `npm run test:unit` → all pass.

### Task 2: Remove supply-side entry points from the storefront

**Files:** Modify `frontend/src/components/layout/footer.tsx`, `frontend/src/components/layout/navbar.tsx` (the "Sell with 3DVerse" `DropdownMenuItem`), `frontend/src/components/marketplace/home-content.tsx` (the `.store-seller-note` section) and the storefront CSS rule for `.store-seller-note` (find with grep under `src/styles/marketplace/`); Modify `frontend/scripts/marketplace-smoke.mjs`.

- [ ] **Step 1: Failing smoke assertions.** In `marketplace-smoke.mjs`, after the home page loads (desktop visit), assert all of:
  - `page.getByRole('heading', { name: 'Make or print designs?' })` count is 0
  - the footer (`page.locator('footer')`) text does not contain "For Creators" or "For Print Partners"
  - footer has a link named "Sell on 3DVerse" with `href="/sell"`
  - footer has a heading "Shop"

  For the authenticated customer visit, open the account menu and assert there is no menu item named "Sell with 3DVerse". Push a line to `checks` describing these.
- [ ] **Step 2:** Run the smoke on a production build (`npm run build`, then `npx next start -p 3100`, then `node scripts/marketplace-smoke.mjs http://127.0.0.1:3100`) → FAIL on the new assertions.
- [ ] **Step 3: Edits.**
  - Footer: remove the two columns; rename "For Customers" → "Shop"; add `{ href: "/sell", label: "Sell on 3DVerse" }` as the first item under "Company"; grid `md:grid-cols-5` → `md:grid-cols-3`.
  - Navbar: delete the "Sell with 3DVerse" item. Remove the `Store` icon import if unused.
  - Home: delete the seller-note section and its CSS rule.
- [ ] **Step 4:** Rebuild, restart, rerun `marketplace-smoke` → PASS. Also run `customer-options-smoke`, `auth-smoke` and `support-smoke` → PASS.
- [ ] **Step 5:** ESLint on the changed files (no new errors versus `git show HEAD:` copies); `npm run lint:critical` clean.

### Task 3: Visual check and review

- [ ] Browser check at 375 and 1280 px, signed out: footer layout and the "Sell on 3DVerse" link. Signed in as a creator fixture: the portal switcher still offers Creator Studio. Take screenshots.
- [ ] Open `/opengraph-image` from the production server; confirm the new tagline fits.
- [ ] Final diff review (`git diff`); request code review; report.
