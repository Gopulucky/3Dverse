# 06 — Gap Audit

Every place the live codebase currently contradicts this brand book, as of
this edition. Every path below was confirmed to exist at time of writing.

**Status:** the core token system, dark mode, favicon/OG metadata, the
casing violation and the off-voice hero were fixed in the code pass that
followed this document (see ✅ rows below). The raw-Tailwind-class sweep,
empty-state copy standardization, and the email/notification build-out
remain open — they're larger, mechanical, multi-file changes intentionally
left for a follow-up pass rather than bundled into the same change.

## Identity & metadata

| Gap | Where | Status |
|---|---|---|
| Stock Next.js favicon, unmodified since scaffold | ~~frontend/src/app/favicon.ico~~ | ✅ Fixed — file removed, [frontend/src/app/icon.tsx](../../frontend/src/app/icon.tsx) generates the glyph mark dynamically |
| No OG image, no `openGraph`/`twitter`/`metadataBase` | [frontend/src/app/layout.tsx](../../frontend/src/app/layout.tsx) | ✅ Fixed — `metadataBase`, `openGraph`, `twitter` added; [frontend/src/app/opengraph-image.tsx](../../frontend/src/app/opengraph-image.tsx) generates the share card. Manifest/robots/sitemap still not added. |
| Meta description says "premium marketplace," drifted from `BRAND.oneLiner` | [frontend/src/app/layout.tsx](../../frontend/src/app/layout.tsx) | ✅ Fixed — title/description now read from `BRAND` directly |
| `globals.css` header cites a `FRONTEND_DESIGN.md v1` that does not exist in the repo | [frontend/src/app/globals.css](../../frontend/src/app/globals.css) | ✅ Fixed — header now points at `docs/brand/` |

## Verbal

| Gap | Where | Status |
|---|---|---|
| Casing violation: `"Sell with 3Dverse"` (should be `3DVerse`) | [frontend/src/components/creator/sell-with-3dverse.tsx](../../frontend/src/components/creator/sell-with-3dverse.tsx) | ✅ Fixed |
| Off-voice hero: "The Future of 3D Printing" / hard-coded Unsplash background / dead "Shop Now" button | [frontend/src/components/marketplace/home-content.tsx](../../frontend/src/components/marketplace/home-content.tsx) | ✅ Fixed — now renders `BRAND.tagline` over the brand gradient + layer-line texture, CTA reads "Browse the marketplace" and scrolls to the catalogue |
| Privacy Policy / Terms of Service rendered as `<span>`, not links | [frontend/src/components/layout/footer.tsx:120](../../frontend/src/components/layout/footer.tsx#L120) | Open — link once those pages exist, or remove the false affordance |
| Empty-state copy inconsistent in punctuation/completeness (`"No products yet."` vs `"No printers yet"` vs `"No royalty data yet."`) | ~8 files across creator/partner/admin (products, printers, stock, partner tickets, trust-safety, DesignerOnlyDashboard) | Open — standardize to `"No {noun} yet."` + a next action, per voice matrix |

## Visual / tokens

| Gap | Where | Status |
|---|---|---|
| `bg-ink/...` used but `--color-ink` never defined — invisible modal overlays and badges | [dialog.tsx](../../frontend/src/components/ui/dialog.tsx), [navbar.tsx](../../frontend/src/components/layout/navbar.tsx), [sponsored-badge.tsx](../../frontend/src/components/shared/sponsored-badge.tsx), [ExplainerModal.tsx](../../frontend/src/components/collaboration/ExplainerModal.tsx), [creator/portfolio/page.tsx](../../frontend/src/app/creator/portfolio/page.tsx) | ✅ Fixed — `--color-ink` defined in [globals.css](../../frontend/src/app/globals.css) as a fixed (non-theme-flipping) scrim |
| `bg-grid-pattern` referenced, never defined | [frontend/src/app/about/page.tsx:49](../../frontend/src/app/about/page.tsx#L49) | ✅ Fixed — utility defined in globals.css |
| `next-themes` installed but never wired; no `.dark` block; zero `dark:` variants | [providers.tsx](../../frontend/src/components/providers.tsx), [globals.css](../../frontend/src/app/globals.css) | ✅ Fixed — `ThemeProvider` wired (`defaultTheme="system"`), full 12-step dark ramp added. **Caveat found during implementation:** Tailwind v4's `@theme inline` bakes literal hex values into compiled utilities, bypassing the CSS variable at runtime — any semantic token declared as a bare literal (as `--color-card`/`-popover`/`-primary-foreground`/`-destructive-foreground` originally were) silently ignores `.dark` overrides. Fixed via a `--surface-*`/`--on-solid-*` indirection layer; documented in the CSS comments. Any *new* semantic token must alias to a `var()`, never a bare hex, or it will have the same silent bug. |
| 48 raw Tailwind palette classes bypassing the brand palette | 9 files — heaviest: [orders/[id]/page.tsx](../../frontend/src/app/orders/%5Bid%5D/page.tsx) (23), [collaboration/page.tsx](../../frontend/src/app/collaboration/page.tsx) (7) | Open — replace with semantic tokens; add an ESLint/Tailwind rule banning raw palette classes outside `globals.css` |
| ~117 arbitrary-value classes (`text-[...]`, hard-coded `#hex`, `font-[...]`) | 26+ files — heaviest: [navbar.tsx](../../frontend/src/components/layout/navbar.tsx) (14) | Open — same remediation |
| No defined type scale — sizes chosen ad hoc per file | Platform-wide | ✅ Fixed — named scale (`text-display-lg` … `text-data-sm`) added as utilities in globals.css. Not yet adopted by existing components — new/edited components should use it. |

## Structural

| Gap | Where | Status |
|---|---|---|
| `frontend/src/lib/brand.ts` calls itself "single source of truth" but holds no colour/type/logo rules (deleted in commit `24c5648`) | [frontend/src/lib/brand.ts](../../frontend/src/lib/brand.ts) | ✅ Fixed — `BRAND_COLORS`, `AUDIENCE_ACCENT_HUE`, `BRAND_TYPE`, `LOGO_RULES` restored |
| Zero email infrastructure; `Notification(...)` is never constructed anywhere in the backend | [backend/app/models/notification.py](../../backend/app/models/notification.py) | Open — functional gap as much as a brand one, out of scope for this pass |
| PDF invoice generator carries no brand | [backend/app/core/invoice.py](../../backend/app/core/invoice.py) | Open |
| No logo glyph mark existed — only the text wordmark | [frontend/src/components/shared/wordmark.tsx](../../frontend/src/components/shared/wordmark.tsx) | ✅ Fixed — glyph mark implemented in `icon.tsx` and `opengraph-image.tsx` (layer-line "3", violet-9 fill) |

## Not a gap — explicitly correct, do not "fix"

- [frontend/src/components/layout/navbar.tsx:508](../../frontend/src/components/layout/navbar.tsx#L508) — `"Sell with 3DVerse"`, correct casing. Listed only as the contrast case for the violation above.
- `AUDIENCE_ACCENT` mapping in [frontend/src/app/about/page.tsx:35-39](../../frontend/src/app/about/page.tsx#L35-L39) — this is correct and is the source the platform-wide audience-accent rule in [03-visual.md](03-visual.md) was promoted from. Don't remove it; extend the pattern outward instead.
