# Premium hero and motion Implementation Plan

> **Replaced the same day.** The vase, scroll motion and card tilt described here were removed. `frontend/design.md` has the current rules.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, this session). No commits unless the owner asks.

**Goal:** A home hero with a self-printing 3D vase, scroll reveals and depth details across the storefront.

**Architecture:** Pure logic (copy, motion maths, vase shape, hero state) in `src/lib/`, unit tested. Small client components consume it. `three` loads lazily over a server-rendered SVG still.

**Tech Stack:** Next 16.4.2, React 19, `three`, `@react-three/fiber` (installed). No new packages.

**Spec:** `docs/superpowers/specs/2026-11-28-premium-hero-and-motion-design.md`

## Global Constraints

- Headline exactly "Ideas you can hold."; sentence per availability as written in the spec.
- Colours and fonts from tokens only. Animate `transform` and `opacity` only.
- Content is visible without JavaScript; reduced motion shows end states; on-screen content is never hidden.
- Hallmark Floor: no label above the headline (drops the spec's sketched eyebrow); any loop over 5 s has a visible pause control.
- Under 80 words before the first product. No new dependencies.
- Keep classes `.home-tiles`, `.home-tile--printed`, `.home-tile--digital` and `data-state="coming-soon|available"`.

## Review Focus

- Reduced motion, data saver or no WebGL: still picture, no canvas, no missing content.
- WebGL context lost after start: falls back to the still.
- Keyboard focus into a not-yet-revealed block: it shows.
- Short landscape phone: both hero buttons reachable, no sideways scroll.
- Theme switched while the vase is on screen: its colours follow.

---

### Task 1: Pure logic

**Files:**
- Create: `frontend/src/lib/motion.ts`, `frontend/src/lib/vase.ts`, `frontend/src/lib/machines/hero-print.ts`
- Modify: `frontend/src/lib/store-availability.ts`
- Test: `frontend/scripts/machines/{motion,vase,hero-print}.test.mjs`, `store-availability.test.mjs`

**Produces:**
- `heroSentence(a: StoreAvailability): string`
- `shouldHideForReveal(top: number, viewportHeight: number): boolean` (true only when `top >= viewportHeight`)
- `revealDelay(index: number): number` (ms: `(index % 6) * 50`)
- `tiltAngles(x, y, rect, max = 6): { rx, ry, gx, gy }` (degrees clamped to ±max; glare in 0..100 %)
- `canRender3d({ reducedMotion, saveData, webgl }): boolean`
- `VASE_LAYERS`, `vaseRadius(t: number, angle: number): number` (t 0..1, positive), `printProgress(elapsedMs, durationMs = 4000): number` (0..1, clamped, non-decreasing)
- `reduceHeroPrint(state, event)`; state `{ status: "still"|"printing"|"done"; paused: boolean }`; events `ready`, `finished`, `lost`, `toggle`; ignored events return the same object.

- [ ] Write tests for every signature above; run `npm.cmd run test:unit`; expect failures for missing modules.
- [ ] Implement; run again; expect all pass.

### Task 2: Hero

**Files:**
- Create: `components/marketplace/home-hero.tsx`, `components/marketplace/hero-print.tsx`, `components/marketplace/hero-print-scene.tsx`, `styles/marketplace/motion.css`
- Modify: `components/marketplace/home-content.tsx`, `app/globals.css` (import), `styles/marketplace/tokens.css` (`--hero-print`, `--hero-nozzle`, motion tokens), `scripts/marketplace-smoke.mjs`

**Produces:** `<HomeHero availability />`; `<HeroPrint />` with `data-flow="hero-print"`, `data-state`, `data-paused`.

- [ ] Smoke first: new headline; both buttons inside the first screen at all six widths; first product top `< 2 × height`; reduced motion has no `canvas` and a visible still; with `reducedMotion: 'no-preference'`, state reaches `printing` then `done`, and the pause button toggles `data-paused`.
- [ ] Run against the current build; expect failure on the headline.
- [ ] Build the components. Scene uses `next/dynamic` with `ssr: false`, loads after idle when `canRender3d`, reveals layers with `setDrawRange`, `frameloop="never"` when paused, off screen or hidden. No drei helpers that fetch remote files.

### Task 3: Scroll reveals and details

**Files:**
- Create: `components/shared/reveal.tsx` (`useReveal(ref, index?)`, `<Reveal index? className?>`), `components/shared/use-tilt.ts` (`useTilt(ref)`)
- Modify: `product-card.tsx`, `home-content.tsx`, `layout/navbar.tsx` (frosted + shadow when `scrolled`), `ui/button.tsx` (press scale), `app/about/page.tsx`, `app/sell/page.tsx`, `app/marketplace/[id]/page.tsx` (reveal the tabs block), `motion.css`

- [ ] Smoke first: with motion on, a below-fold block starts `data-reveal="pending"` and becomes `shown` after scrolling; nothing on screen is pending at load; reduced motion leaves no `data-reveal`.
- [ ] Run; expect failure. Implement. Run; expect pass.

### Task 4: Documents and verification

**Files:** `frontend/design.md` (home layout, motion), `frontend/src/lib/machines/README.md` (`hero-print` row)

- [ ] `npx.cmd tsc --noEmit`, ESLint on changed files, `npm.cmd run lint:critical`, `npm.cmd run test:unit`, `npm.cmd run build`: all exit 0.
- [ ] `npm.cmd run test:browser`: all smoke scripts pass.
- [ ] Hallmark `sloplint.mjs --render` against the running site; fix failures that this change introduced.
- [ ] Look at light and dark, phone and desktop in the browser pane.
