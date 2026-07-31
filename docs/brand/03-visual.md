# 03 — Visual Identity

## Colour — the decision

**Keep the existing brand hues. Rebuild how they're expressed.**

The three brand colours already in `globals.css` are kept as-is, because
they already carry meaning that shipped code depends on:

| Hue | Anchor hex | Carries |
|---|---|---|
| **Cure Violet** | `#6366F1` | Primary brand colour, customers |
| **Nozzle Orange** ("ember") | `#EA580C` | Creators, revenue, the "make it real" moment |
| **Calibration Green** ("moss") | `#059669` | Print partners, capacity, verified/certified states |

The audience→colour mapping (creators→ember, customers→violet,
partners→moss) currently exists only as a local constant
(`AUDIENCE_ACCENT`) in `about/page.tsx`. It's promoted here to a
platform-wide rule: **wherever the UI needs to signal which side of the
network something belongs to — a creator's product card, a partner's job
queue, a customer-facing order — use that audience's accent, not an
arbitrary colour.**

What changes is not the hues but the system around them:

1. **Every colour is generated as a 12-step OKLCH scale, not a single hex.**
   A single hex per brand colour is why the platform currently has 48 raw
   Tailwind palette classes and ~117 arbitrary hex values scattered across
   the codebase — there's no vocabulary for "the same violet, but for a
   subtle background" so people reach for `text-slate-600` or a one-off
   `#hex`. The scale gives every one of those needs a name.
2. **Steps map to fixed roles**, so choosing a colour becomes choosing a
   role, not eyeballing a shade:

   | Steps | Role |
   |---|---|
   | 1–2 | App background, subtle background |
   | 3–5 | Component background — rest, hover, active |
   | 6–8 | Borders — subtle, UI, strong |
   | 9–10 | Solid fills — default, hover |
   | 11–12 | Text — low-contrast (AA), high-contrast (AAA) |

3. **Dark mode is a parallel scale, not a hand-tuned afterthought.** Same
   12 roles, different lightness ramp, generated from the same anchor hue.
   Full values in [04-technical.md](04-technical.md).
4. **The palette stays small on purpose:** 3 brand hues (violet, ember,
   moss) + 1 neutral (slate) + 3 status hues (red, amber, green — status
   only, never decoration). Seven scales, not seventeen. Adding hues is
   how a platform loses its look; every additional colour proposal should
   be tested against "does this need a new hue, or does it need a
   different step of an existing one" — usually it's the latter.

### Why OKLCH specifically

Hex and HSL are not perceptually uniform — two colours at "the same
lightness" in HSL can look very different in actual brightness, which is
exactly why hand-picked palettes end up lopsided (one hue reads darker or
louder than the others at the same nominal weight). OKLCH's lightness axis
is calibrated to how humans actually perceive brightness, so violet and
ember at the same `L` value genuinely read as the same weight. That
property is also what makes the 12-step scale *generatable* rather than
hand-tuned per step — see [04-technical.md](04-technical.md) for the exact
generation method and the contrast proof for every step.

## Typography — the decision

**Keep the three faces. Add the missing scale.**

| Face | Role | Already wired via |
|---|---|---|
| **Space Grotesk** | Display — headlines, the wordmark | `next/font/google`, `--font-display` |
| **IBM Plex Sans** | Body — everything a person reads | `next/font/google`, `--font-sans` |
| **IBM Plex Mono** | Data — money, dimensions, IDs, weights | `next/font/google`, `--font-mono` |

The faces are correct: Grotesk gives headlines a technical-but-warm
character that fits "operating system for physical creation" better than
a generic geometric sans; Plex Sans is built for long reading at UI sizes;
Plex Mono with tabular figures is what makes a table of prices or spool
weights align instead of jittering column to column.

**The gap is that there's no defined scale.** Sizes are currently picked
ad hoc per file — that's a code-level problem, not a typeface problem, and
it's the type equivalent of the raw-Tailwind-colour drift above. The fix
is the same shape: name the roles, lock the values, reference the name.

| Token | Face | Size / line-height | Weight | Use |
|---|---|---|---|---|
| `display-lg` | Grotesk | 3.5rem / 1.05 | 600 | Hero H1 |
| `display-md` | Grotesk | 2.5rem / 1.1 | 600 | Section hero, page H1 |
| `display-sm` | Grotesk | 1.75rem / 1.2 | 600 | Card/module hero |
| `heading-1` | Grotesk | 1.5rem / 1.3 | 600 | Page section heading |
| `heading-2` | Grotesk | 1.25rem / 1.35 | 600 | Subsection heading |
| `heading-3` | Sans | 1.0625rem / 1.4 | 600 | Card title |
| `heading-4` | Sans | 0.9375rem / 1.4 | 600 | Small group label |
| `body-lg` | Sans | 1.0625rem / 1.6 | 400 | Lead paragraph |
| `body-md` | Sans | 0.9375rem / 1.6 | 400 | Default body |
| `body-sm` | Sans | 0.8125rem / 1.5 | 400 | Secondary text |
| `label` | Sans | 0.8125rem / 1.3 | 500 | Form labels, tabs |
| `caption` | Sans | 0.75rem / 1.4 | 400 | Timestamps, helper text |
| `data-md` | Mono | 0.9375rem / 1.5, tabular-nums | 500 | Prices, order IDs |
| `data-sm` | Mono | 0.8125rem / 1.4, tabular-nums | 500 | Table cells, badges |

**Hard rule:** all currency, dimensions, weights, percentages, take rates
and IDs render in `data-md`/`data-sm` (Plex Mono, tabular figures) — never
in the body face. This is what "Say the real number" looks like typeset:
numbers that hold still and align.

## Logo

The wordmark exists — `frontend/src/components/shared/wordmark.tsx` splits
`3D` (gradient) and `Verse` (foreground), in `font-display`. It's correct
and should not be redrawn.

**Missing: a glyph mark.** There is currently no icon-only mark, which
means favicon, app icon, and social avatars fall back to a stock Next.js
icon. Spec for a future SVG pass:

- Derived from the layer-line motif already in `globals.css`
  (`--animate-layer-line`, the "signature 3DVerse progress motif") — a
  stacked-layer **"3"** built from three to four horizontal bands with a
  slight stagger, echoing an FDM print's visible layer lines.
- Single-colour by default (the violet step-9 solid), never a gradient at
  small sizes — gradients break down under 32px.
  A two-colour variant (violet body, ember top layer) is permitted at
  ≥64px where the audience-accent convention is relevant (e.g. per-creator
  avatars could tint the top layer to the creator's accent).
- Must sit legibly inside a square with even padding on all sides —
  needed for favicon, app icon and OG image use simultaneously.

## Motion

`--animate-layer-line` (`layer-line-fill`, 1.8s ease-in-out, infinite) is
the signature motif — a fill that grows and recedes like a print building
up layer by layer. Reserve it for genuine progress/loading states tied to
"something is being made" (upload processing, printability check running,
order moving through print queue). Do not use it as decorative ambient
motion — its meaning is "this is happening right now," and using it
cosmetically dilutes that.

`.hover-lift` and `.hover-tilt` (already in `globals.css`) are fine as
general-purpose interaction motion and carry no specific brand meaning.

## Photography

**Real prints, not stock photography.** The current homepage hero uses a
hard-coded Unsplash image — replace the *category* of image, not just that
one file. Direction:

- Actual 3D-printed objects, shot with visible layer lines and honest
  surface imperfections. The layer lines are not a flaw to retouch out —
  they're proof the object is real and the platform's product actually
  works.
- Backgrounds: paper-white (`slate-1`/`slate-2`) or a workshop surface
  (matte concrete, plywood) — never a lifestyle stock scene unrelated to
  making things.
- People, when shown, are mid-task — inspecting a print, packing an order —
  not posed stock-photo smiling-at-laptop shots.
- No AI-generated renders standing in for real product photography on
  marketing surfaces; renders are fine *inside* the product as 3D-viewer
  previews, where they're clearly the model itself, not marketing imagery.

## Iconography

No custom icon set exists yet; the product uses a standard icon library
(lucide, based on current component imports). That's an acceptable
default — document rather than replace: icons render at `slate-11`/`-12`
for default state, brand-hue step-9/-11 only when indicating an
audience-specific or status action (e.g. an ember icon for a
creator-specific action), never decoratively.
