# Design: 3DVerse storefront

Shared by `/` and `/marketplace/home`. Both routes render the same homepage.
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

- Customers: violet, anchored at `#6366F1`.
- Creators: ember, anchored at `#EA580C`.
- Print partners: moss, anchored at `#059669`.
- Display: Space Grotesk, 600. Body and controls: IBM Plex Sans.
- Currency and measurements: IBM Plex Mono with tabular numerals.
- Font variables belong on `html` so root theme aliases resolve correctly.
- Container: `--store-container` (90rem), centred, with `--store-gutter`.
- Column gap below the hero: `--store-gap` (1.5rem).
- Image radius: `--store-radius` (0.75rem).
- Surface/text pairs use semantic tokens and switch together in dark mode.

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
