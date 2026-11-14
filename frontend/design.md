# Design: 3DVerse storefront

Shared by `/` and `/marketplace/home`. Both routes render the same homepage (products first, see below).
Uses the existing 3DVerse colour and type values captured from the project
and recorded below. `src/lib/brand.ts` holds the shared identity and copy.

## System

- Genre: modern-minimal.
- Shape: Catalogue, with a Stage hero when catalogue imagery is available.
- Theme: existing 3DVerse brand; restrained colour and still composition.
- Signature: a real catalogue object with its actual title, creator and price.
- No catalogue data: a typographic hero and an honest loading, empty or error state.
- Keep actual content, links and API wiring. Never invent products or social proof.

## Tokens

`src/app/globals.css` defines the light brand scales and semantic aliases.
`src/styles/marketplace/tokens.css` defines the dark scales and storefront scale.

Three brand colours, used 60/30/10. Token names are unchanged (`slate-*`,
`violet-*`, `ember-*`), only their values; `scripts/machines/brand-palette.test.mjs`
pins the anchors and WCAG AA pairs.

- 60% cool white + ink (`slate-*`): page `#FFFFFF`, image wells `#EEF2F4`, text `#12181B`;
  dark `#0F1315` / `#E4E9EB`. Neutrals lean cool (never beige) to match the teal and
  product photography; the palette test enforces it.
- 30% Deep teal (`violet-*`, `primary`): `#0E5E6F` with white text; dark `#4FC3D4` with dark ink.
  Trust: primary buttons, Add to cart, links, focus. Customers' accent.
- 10% Tangerine (`ember-*`): `#FF7A1A`; dark `#FF8A3D`. Always dark ink on it
  (`text-ember-foreground`). Purchase intent and warmth: Buy now, cart count,
  Featured badges, applied-filter chips, category-chip hover, the wordmark "3D".
  Creators' accent.
- Tangerine is a fill, never text: it is ~2.4:1 on white. Text and solid
  selected borders use `ember-ink` (`#B04A00`); translucent `ember/NN` tints are decorative.
- Warning amber is a yellow-ochre (`#C99A06`, ink `#7A5600`), held 15° of hue
  away from Tangerine so a warning never reads as the brand. Warning text uses `warning-ink`.
- Moss (`#059669`) is functional only: success states and the print-partner portal.
  Never in the logo or marketing.
- Input borders (`slate-8`) meet 3:1 non-text contrast on page and card.
- Day/night: `ThemeToggle` in the navbar (sun in day, moon at night, 44px target,
  `role="switch"` named "Night mode"). Starts from the OS scheme; a click is stored
  by next-themes. `dark:` utilities follow the `.dark` class, not the media query.
- Display: Space Grotesk, 600. Body and controls: IBM Plex Sans.
- Currency and measurements: IBM Plex Mono with tabular numerals.
- Font variables belong on `html` so root theme aliases resolve correctly.
- Fonts are self-hosted in `src/app/fonts` via `next/font/local` (latin + latin-ext, OFL
  licences alongside); never `next/font/google`, so builds need no network.
  Regenerate with `scripts/fonts/build_fonts.py`.
- Container: `--store-container` (90rem), centred, with `--store-gutter`.
- Column gap below the hero: `--store-gap` (1.5rem).
- Image radius: `--store-radius` (0.75rem).
- Surface/text pairs use semantic tokens and switch together in dark mode.

## Home layout (products first)

Order, top to bottom: header with search, category chips, one-line heading,
two format tiles (Printed products, Digital models), a "New arrivals" row, a
"Trending" row, a three-item trust strip. Targets, checked by
`scripts/marketplace-smoke.mjs`: the first product starts on the first screen
at 320-1920 px, fewer than 80 words come before it, and no product appears
twice. Row and fallback rules live in `src/lib/home-sections.ts`.

- Home cards use `ProductCard compact` (image, title, price caption). Catalogue
  pages keep the full card.
- Product grid: 6 columns, then 5, 4, 3 and 2 on narrow screens.
- No creator or print-partner promotion on the home page (see
  `docs/superpowers/specs/2026-11-11-customer-clarity-design.md`).

## Cart and orders

- Cart: item rows (image, title, format, price, quantity stepper, Remove) beside a
  "Price details" card; on phones the total and Checkout sit in a fixed bottom bar.
  Totals and blocked states come from `src/lib/cart-summary.ts`.
- Quantity changes show at once and sync in the background; the navbar badge and the
  cart page share one `["cart"]` query (`src/lib/use-cart.ts`).
- Orders: filter chips (All, In progress, Delivered, Cancelled) and one card per order
  with a plain-language headline from `src/lib/order-view.ts`. Digital-only paid orders
  read "Ready to download" with no print progress bar.
- Checked by `node scripts/cart-orders-smoke.mjs` and the query-count tests in
  `backend/tests/test_cart_orders_queries.py`.

## Images

- Every uploaded product image also gets a 480px WebP copy (`thumb_url`, made in
  `backend/app/core/images.py`). Cards, the cart, orders, wishlist and creator lists
  show it through `productThumb` / `ThumbImage`, falling back to the original when the
  copy is missing (images uploaded before thumbnails) or fails to load.
- The product page keeps the full-size image. Existing images are filled in with
  `python -m scripts.backfill_thumbnails` (counts only unless `--apply`).

## Controls

- Browse action: `--store-action` / `--store-action-ink`, 48px high.
- Secondary links: underlined, 44px minimum hit height, no appended arrow text.
- Cart buttons: independent of product links, with loading and inline outcome states.
- Instant focus outlines use `--store-focus`; reduced motion removes animations.
- Use sentence case for labels, with normal letter spacing.

## Motion and imagery

- No ambient motion or load reveals. Rail scrolling respects reduced motion.
- Uploaded product media is the source for hero and card images.
- Failed images show a labelled fallback. Category links are typographic.
- The existing gradient wordmark remains a brand asset, not heading decoration.

## Exports

Storefront CSS: `src/styles/marketplace/{tokens,base,storefront}.css`.
Browser verification: `node scripts/marketplace-smoke.mjs` with a local server.
Test fixtures are intercepted in the browser and never shipped in the catalogue.
