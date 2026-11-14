# Teal, Tangerine and Porcelain palette

Status: approved by the owner on 2026-11-14 ("Go with A").

## Intent

The owner did not like Neel indigo + Terracotta + Chalk. Both brand colours
were dark and muted, so the page had no single point of energy and read as a
heritage textile brand rather than a 3D-printing marketplace. The new palette
must keep trust for Indian buyers, stand apart from Flipkart/Amazon/Myntra
blue, and give the purchase action one unmistakable colour.

## Approaches considered

- **A. Deep teal + tangerine + porcelain (chosen).** Calm and trustworthy,
  distinct from the blue incumbents; tangerine evokes the hot nozzle and is
  the only bright colour, so Buy now leads.
- B. Graphite + electric lime + paper. Sharp maker-tech look; cold for
  first-time buyers.
- C. Plum + saffron + cream. Premium, craft-boutique; less "tech".

## Design

60/30/10 is unchanged. Token names stay `slate-*` / `violet-*` / `ember-*`;
only values change, so call sites keep working.

| Role | Light anchor | Dark anchor |
|------|--------------|-------------|
| 60% neutrals (`slate-*`) | page Porcelain `#F7F6F2`, ink `#16191D` | `#0F1315` / `#E4E9EB` |
| 30% primary (`violet-*`) | Deep teal `#0E5E6F` (white text) | `#4FC3D4` (dark ink) |
| 10% accent (`ember-*`) | Tangerine `#FF7A1A` (dark ink) | `#FF8A3D` (dark ink) |

- Tangerine cannot carry white text at WCAG AA, so solid ember fills use a new
  `--color-ember-foreground` (light: slate-12, dark: slate-1). The palette test
  checks ink-on-tangerine instead of white-on-terracotta.
- Tangerine fails as text on porcelain. Bare `text-ember` (57 uses) moves to
  `text-ember-ink` (ember-11, `#B04A00` light), which passes AA on the page
  and on `ember-surface`. Tints (`bg-ember/10`) and borders keep `ember`.
- Moss stays functional only (success, print-partner portal).
- `brand.ts`, `design.md`, the favicon (`icon.tsx`) and the OG image move to
  the new anchors.

## Non-goals

No layout, typography, copy or rename changes. Moss, red, amber and green
functional scales are untouched.

## Left to the builder

Intermediate scale steps (1-8, 10, 12), chosen so every AA pair in
`brand-palette.test.mjs` passes.
