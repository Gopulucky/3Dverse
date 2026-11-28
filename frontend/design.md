# Design: buy&sell3d storefront

Shared by `/` and `/marketplace/home`. Both routes render the same homepage (short hero, then product cards, see below).
Uses the existing buy&sell3d colour and type values captured from the project
and recorded below. `src/lib/brand.ts` holds the shared identity and copy.

## System

- Genre: modern-minimal.
- Shape: Catalogue under a short text hero. Minimal: white space, thin rules, no
  decoration, no scroll storytelling.
- Theme: existing buy&sell3d brand; restrained colour, motion with a job.
- Signature: printed layers. Product cards and the two hero buttons stand on a stack
  of thin lines, like a solid 3D print, and lift when pointed at (`motion.css`).
  It is the one bold detail; keep everything around it quiet.
- The space right of the hero text is left blank for the owner's own 3D design,
  to be added later. Do not fill it with stand-in art.
- No catalogue data: the hero stays; the rows show an honest loading, empty or error state.
- Keep actual content, links and API wiring. Never invent products or social proof.

## Tokens

`src/app/globals.css` defines the light brand scales and semantic aliases.
`src/styles/marketplace/tokens.css` defines the dark scales and storefront scale.

Three brand colours, used 60/30/10. Token names are unchanged (`slate-*`,
`violet-*`, `ember-*`), only their values; `scripts/machines/brand-palette.test.mjs`
pins the anchors and WCAG AA pairs.

- 60% white + ink (`slate-*`): page `#FFFFFF`, image wells `#F0F0F0`, text `#12181B`;
  dark `#0F1315` / `#E4E9EB`. Light fills and hairlines (`slate-2…7`) are hue-less greys:
  no blue or beige cast, so nothing tints the page behind the teal and the photography. Cards
  (including the Digital models tile) are white with a border. The palette test enforces it.
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
- Moss (`#059669`) is functional only: success states. Never identity: not in the
  logo, marketing or any portal.
- Portals (Creator Studio, Print Partner Console, Admin) wear the same palette as
  the storefront: Deep teal is identity (active nav, tabs, page and KPI icons,
  links, primary buttons). Tangerine stays a fill for selected chips and badges.
  Green, ochre and red appear only as status. The Creator path badge is the one
  variation: Studio is a tangerine tint, Seller teal, Designer neutral. Pinned by
  `scripts/machines/brand-palette.test.mjs`.
- Input borders (`slate-8`) meet 3:1 non-text contrast on page and card.
- Day/night: `ThemeToggle` in the footer (portal headers keep it) (sun in day, moon at night, 44px target,
  `role="switch"` named "Night mode"). Starts from the OS scheme; a click is stored
  by next-themes. `dark:` utilities follow the `.dark` class, not the media query.
- Logo (`components/shared/wordmark.tsx`): Space Grotesk bold with an Inter `&` in
  tangerine; layered `&` only at large size (the footer). Never smaller than 20px type.
- Space Grotesk: logo, headings, product names (class `.display` for titles, sentence
  case). Inter: navigation, descriptions, prices, buttons. Weights 400, 500, 600, 700.
  Buttons and chips are pill shaped; text fields and pickers have 12px corners (`rounded-lg`).
- Currency and measurements: Inter with tabular numerals.
- Font variables belong on `html` so root theme aliases resolve correctly.
- Fonts are self-hosted in `src/app/fonts` via `next/font/local` (latin + latin-ext, OFL
  licences alongside); never `next/font/google`, so builds need no network.
  Regenerate with `scripts/fonts/build_fonts.py`.
- One container for header, pages and footer (`.store-container`): at most 1600px of
  content, 32-48px outer margins on desktop, 16px on phones.
- Grid gap: `--store-gap` (1.5rem). Space between page sections: `--store-stack` (2.5rem).
- Card and picture radius: `--store-radius` (0.75rem). Buttons are 44-48px high.
- Surface/text pairs use semantic tokens and switch together in dark mode.

## Header, search and preferences

- The shop header holds the logo, one search field, the cart and the account (or sign
  in). No category picker or "Orders" link there.
- Country/currency and day/night live in the footer. Notifications open from the
  account menu, which shows a dot when one is unread. Portals keep day/night in
  their header.
- One search per screen: the header on wide screens; on phones the catalogue's own
  field, and the menu's field on other pages.
- Categories come from `src/lib/categories.ts`, in that order, everywhere.

## Product cards and catalogue

- Catalogue order: title and one line, category chips, product type tabs (All, Digital
  models, Printed products), count left and one Sort picker right, grid, pager. No side
  panel and no price or currency boxes; `min_price`, `max_price` and `currency` in a
  saved link still apply and show as removable chips.
- The lead line promises prints only when they can be ordered.
- Category chips (`components/marketplace/chip-row.tsx`) are the same on the home page
  and the catalogue; the chosen one is solid teal. The row scrolls sideways.
- Grid: 4 columns from 64rem, 3 from 40rem, 2 below (`.catalogue-grid`), also used for
  creator pages and Similar designs.
- Card: 4:3 picture shown whole (`object-fit: contain`), format badge, wishlist heart,
  uppercase category, name, creator, one price ("From" when two formats), one "View
  product" button. No rating, Featured label or Add to cart on the card.
- The printed-layer edge sits under the whole card.
- Prices drop empty paise (`₹249`, `₹249.50`).
- The pager shows only when there is more than one page.

## Product page

- Same container as the catalogue. Two columns, about 60/40: viewer (3D model first)
  and thumbnails; beside it the name, creator, price and buttons. On phones: name,
  viewer, then the rest.
- Viewer toolbar: zoom, fullscreen, settings, each 44px. Wireframe, grid, lighting,
  auto-spin, reset and mesh counts live in the settings panel. Grid starts off. The view
  pulls back in narrow frames so wide models are not cut off.
- Buy column order: name, creator, price and licence, format, "Buy now" (tangerine),
  "Add to cart" (outline), delivery note, quiet links. Shipping links only for printed
  items.
- Below, full width, once each: About this design, What’s included, Printing
  specifications, Creator, Reviews, Similar designs. Section name at the side, content
  beside it, separated by thin rules (no boxes). Rows come from
  `src/lib/product-details.ts`; a fact the listing does not have gets no row. Never show
  a default print setting as the creator’s advice.
- Reviews name the buyer by first name or "Verified buyer", never an email.

## Home layout

Order, top to bottom: header with search, category chips, a short hero, a "New
arrivals" row of product cards, a "Trending" row, a three-item trust strip. The
hero holds the headline "Ideas you can hold.", one sentence that promises delivery
only when printed orders work (`heroSentence` in `src/lib/store-availability.ts`)
and the Printed products and Digital models buttons. Targets, checked by
`scripts/marketplace-smoke.mjs`: the first product starts on the first screen at
320-1920 px, fewer than 80 words come before it, and no product appears twice. Row
and fallback rules live in `src/lib/home-sections.ts`.

- Home cards use `ProductCard compact` (image, title, price caption) with the printed
  layers under the picture. Catalogue pages use the full card.
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
- Text fields and pickers show focus on their own edge (the header search lights its
  whole pill), never as a second ring behind them. Buttons and links keep the outline
  for keyboard users.
- Use sentence case for labels, with normal letter spacing.

## Motion and imagery

Styles are in `src/styles/marketplace/motion.css` (cards, hero, header) and `pages.css`.

- Nothing animates on scroll or load. The only motion answers a person: a card or
  hero button lifts on hover and focus, buttons press, menus open.
- All pages: the header turns frosted once scrolled.
- Animate `transform` and `box-shadow` only here; rail scrolling respects reduced motion.
- Category links are chips; hovering one outlines it in tangerine.
- A card names each format once, in its price rows.
- Uploaded product media is the source for hero and card images.
- Failed images show a labelled fallback.
- The existing gradient wordmark remains a brand asset, not heading decoration.

## Exports

Storefront CSS: `src/styles/marketplace/{tokens,base,storefront}.css`.
Browser verification: `node scripts/marketplace-smoke.mjs` with a local server.
Test fixtures are intercepted in the browser and never shipped in the catalogue.
