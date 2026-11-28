# Premium hero and motion

Status: partly replaced · 2026-11-28. The printing vase and full-screen hero were
later removed; see `frontend/design.md`. Card tilt and scroll fade-ins remain.

## Intent

A visitor should feel within a few seconds that buy&sell3d is a top brand, and
should know what it sells. The site is still and flat today. We add a hero with a
headline and the two shopping buttons, a 3D object that prints itself, scroll
motion and small depth details.

## Decided by you

- Hero centrepiece: a live 3D object that builds itself layer by layer.
- Headline: **"Ideas you can hold."**
- Motion across the whole site, in tiers (below).
- The hero carries the Printed products and Digital models buttons.

## What changes from today's rules

| Today (`frontend/design.md` and smoke test) | New |
|---|---|
| No ambient motion or load reveals | Motion allowed, with the limits in this document |
| First product visible on the first screen | Both hero buttons visible on the first screen; first product within one scroll |
| Small heading, then two format tiles | Hero holds the heading and the two buttons; the separate tiles go |

Still true: under 80 words before the first product, no repeated products, no
invented products, reviews or promises, same colours and fonts.

## The hero

Home page only (`/` and `/marketplace/home`), under the header.

```
+----------------------------------------------------------+
| 3D models and finished prints          .--.              |
|                                       ( == )   <- vase   |
| IDEAS YOU                              \==/     printing |
| CAN HOLD.                              /==\     layer by |
|                                       (====)    layer    |
| <one sentence about the shop>        ~~~~~~~~~~          |
| [Printed products]  [Digital models]   print bed         |
+----------------------------------------------------------+
  category chips  ->  New arrivals  ->  Trending  ->  trust
```

On phones the object sits above the headline, smaller, and the two buttons stay
side by side on the first screen.

**Sentence.** It only promises what works, using the availability the homepage
API already reports:

- Printed orders on: "Finished 3D prints delivered in India, and digital models
  ready for your own printer."
- Printed orders off: "Digital models ready for your own printer. Finished prints
  are coming soon."

**Buttons.** "Printed products" (caption "Delivered in India" or "Coming soon")
goes to `/marketplace?format=physical`. "Digital models" goes to
`/marketplace?format=digital`. The "Tell us what you'd like us to make" link stays
while printing is off.

**The object.** A twisted ribbed vase drawn by code, teal with a tangerine glow on
the layer being printed. It prints once in about 4 seconds, then turns slowly and
leans toward the mouse. It is decoration: no title, price or link, so nobody takes
it for a product.

**Safety nets.**

- The headline and buttons are in the server-rendered page and never wait for 3D.
- A drawn still of the finished vase holds the space until the 3D loads, so
  nothing jumps.
- Reduced motion, no WebGL, or data saver: the still stays and the 3D code is not
  downloaded.
- Drawing stops when the hero is off screen or the tab is hidden.
- No files from other sites (the security policy would block them).

## Motion tiers

| Tier | Pages | What moves |
|---|---|---|
| 1 | Home | Hero print, headline entrance, sections and cards rise in on scroll, 3D card tilt, heading layer-line, hero depth shift while scrolling |
| 2 | Catalogue, product, creator, about, sell | Sections and cards rise in on scroll, 3D card tilt |
| 3 | Cart, checkout, account, dashboards | Button press feel only |

All tiers: the header gains a soft shadow and frosted look once you scroll.

**Details.**

- Scroll reveal: fade and rise, about 0.6 s, small stagger between cards, once.
- Card tilt: up to 6 degrees with a moving light highlight and softer shadow,
  mouse only. Touch screens get a press-down instead.
- Hero buttons: raised edge that presses in.

**Rules.**

- Content already on screen is never hidden and re-shown.
- Without JavaScript everything is visible. Hiding happens only once the script
  that shows it is running.
- Reduced motion turns all of it off.
- Only movement and opacity are animated, so layout does not shift.

## Approaches

**Centrepiece** (you picked the first):

1. Self-printing 3D object. Most memorable, about 3D printing. Heaviest.
2. Floating product photos. Light, but only as good as the uploads.
3. Large type only. Fastest, least striking.

**How the motion is built** (my call):

1. A small reveal and tilt helper of our own plus CSS. No new packages, works in
   all current browsers. **Chosen.**
2. An animation library (Framer Motion or GSAP). Richer effects, more download,
   and adding packages from Windows has broken our Linux build before.
3. CSS scroll timelines only. Very light, but support still differs by browser.

The 3D uses `three` and `@react-three/fiber`, already installed.

## Not doing

- No video, sound, scroll hijacking, custom cursor or loading screen.
- No change to prices, products, checkout, accounts or the backend.
- No new colours or fonts; no change to the wordmark.
- The unused `hero-3d-object.tsx` is left alone.

## Checks

- Unit tests: hero sentence for each availability state; tilt, reveal and print
  progress maths.
- `marketplace-smoke`: updated headline and first-screen rules; with motion on, the
  3D prints and finishes and scrolled content appears; with reduced motion, no
  canvas and nothing hidden; no sideways overflow from 320 to 1920 px.
- `npm run build`, type check, ESLint, `test:unit`, `test:browser`.
- Look at it in the browser, light and dark, phone and desktop.
- `frontend/design.md` updated to match.

Not verified by these checks: frame rate on real low-end phones, and a live
backend.

## Left to the builder

Exact timings, easing, vase proportions and spacing. Work goes on a new branch
from `feat/product-page-redesign`; your uncommitted changes are left alone.
