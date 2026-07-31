# 04 — Technical Guidelines

This file is the only place raw hex values are allowed to appear
uncommented. Everywhere else in the app and in this brand book, reference
the semantic token name.

Values below were generated programmatically (OKLCH ramp per hue, gamut-
mapped to sRGB, text steps iteratively adjusted until they clear their
contrast target) and verified, not hand-picked. Generation method: fixed
lightness/chroma curve per step (Radix-style role assignment), anchored to
each brand hue's existing hex, with steps 11 and 12 pushed until they
independently clear **4.5:1 (AA)** and **7:1 (AAA)** respectively against
steps 1–3 of their own scale. Result: **0 contrast failures across all 7
scales, both themes** on the text steps — see the proof table at the
bottom.

## The 12-step scales

Role legend: **1–2** app/subtle bg · **3–5** component bg (rest/hover/
active) · **6–8** border (subtle/UI/strong) · **9–10** solid fill (default/
hover) · **11–12** text (AA/AAA).

### Violet — `--violet-*` (primary / customers)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Light | `#FCFCFF` | `#F8F9FF` | `#F1F3FF` | `#EAEDFF` | `#E1E6FF` | `#D6DCFF` | `#C6CEFF` | `#ADB8FF` | `#6366F1` | `#5757E1` | `#5A5FD2` | `#2A2E66` |
| Dark | `#0E101D` | `#15172B` | `#1C1E43` | `#212458` | `#28296B` | `#30317F` | `#3D3F9D` | `#5356C9` | `#6C71FD` | `#7D86FF` | `#A1ADFF` | `#D5DCFF` |

### Ember — `--ember-*` (creators)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Light | `#FFFCFB` | `#FFF8F6` | `#FFF1EB` | `#FFE9E1` | `#FFDFD4` | `#FFD3C3` | `#FFC1AB` | `#FFA381` | `#EA580C` | `#D64D00` | `#BB4405` | `#5B2007` |
| Dark | `#1B0D08` | `#27130B` | `#3C1607` | `#4D1701` | `#5B1C00` | `#6B2200` | `#852D00` | `#AE3D00` | `#F76421` | `#FF7D4A` | `#FE946C` | `#FFD3C3` |

### Moss — `--moss-*` (print partners)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Light | `#F9FEFB` | `#F4FCF8` | `#E9F9F0` | `#DDF5E9` | `#D1F0E0` | `#C3E9D6` | `#AFDFC7` | `#8ECEAF` | `#059669` | `#00875E` | `#16805A` | `#0F3F2C` |
| Dark | `#0A130F` | `#0E1D16` | `#0C291D` | `#063423` | `#003E29` | `#004A32` | `#005D3F` | `#057B55` | `#21A173` | `#38B182` | `#7BC7A4` | `#BFEAD4` |

### Slate — `--slate-*` (neutral — most of the UI)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Light | `#FCFDFE` | `#F8FAFC` | `#F1F4F9` | `#EAEEF5` | `#E2E8F0` | `#D8DFE9` | `#CAD2DE` | `#B4BFCE` | `#64748B` | `#57677E` | `#627083` | `#2F3640` |
| Dark | `#101114` | `#17191D` | `#1F232A` | `#262C35` | `#2C343F` | `#353E4B` | `#444F5E` | `#5B697C` | `#6E7E96` | `#7D8DA5` | `#A9B5C7` | `#D7DFEA` |

### Status — red / amber / green (status only, never decoration)

| | 1 | 2 | 3 | 6 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|
| Red · light | `#FFFCFB` | `#FFF8F7` | `#FFF0EE` | `#FFD2CC` | `#DC2626` | `#CC0515` | `#C4332E` | `#601915` |
| Red · dark | `#1C0C0A` | `#29110E` | `#3F120F` | `#750E0F` | `#E93632` | `#FB4A42` | `#FF9084` | `#FFD2CB` |
| Amber · light | `#FFFCFA` | `#FFF8F4` | `#FFF1E7` | `#FDD6B9` | `#D97706` | `#C66B00` | `#A65900` | `#512A03` |
| Amber · dark | `#180F08` | `#23150B` | `#351C06` | `#5E3000` | `#E58220` | `#F69236` | `#EAA268` | `#FFD5B5` |
| Green · light | `#F9FEFA` | `#F3FDF5` | `#E8FAEA` | `#C2EBC8` | `#16A34A` | `#00943F` | `#0F823A` | `#0D401C` |
| Green · dark | `#0A140C` | `#0E1D11` | `#0B2A13` | `#004B1D` | `#2AAE55` | `#40BE64` | `#79CA89` | `#BEECC5` |

*(Steps 4/5/7/8 for status colours follow the same curve as the brand
hues; omitted here for width — generate on demand from the anchor hex
using the method above, or request the full table.)*

## Semantic layer — what components actually use

Components reference these, never the numbered scale directly. This is
the enforcement mechanism: a hue change becomes one edit in this table
instead of a grep-and-replace across the app.

| Semantic token | Maps to |
|---|---|
| `--color-background` | `slate-1` |
| `--color-surface` | `slate-1` (cards sit flush on light bg, current `--color-card: #FFFFFF` is close enough to keep) |
| `--color-surface-raised` | `slate-2` |
| `--color-border` | `slate-6` |
| `--color-border-strong` | `slate-8` |
| `--color-text` | `slate-12` |
| `--color-text-muted` | `slate-11` |
| `--color-text-subtle` | `slate-9` |
| `--color-primary` | `violet-9` |
| `--color-primary-hover` | `violet-10` |
| `--color-primary-surface` | `violet-3` |
| `--color-primary-ink` | `violet-11` |
| `--color-ember` / `--color-creator-accent` | `ember-9` |
| `--color-moss` / `--color-partner-accent` | `moss-9` |
| `--color-customer-accent` | `violet-9` (customers share the primary hue — they're the default audience) |
| `--color-success` | `green-9` |
| `--color-warning` | `amber-9` |
| `--color-destructive` | `red-9` |
| `--color-ink` | **currently undefined — see fix below** |

### Fixing the `--color-ink` gap

`bg-ink/60` and similar are used for modal overlays and badge backgrounds
in 5 files (listed in [06-gap-audit.md](06-gap-audit.md)) against a token
that was never defined, so they render transparent. Define:

```
--color-ink: var(--slate-12);   /* light: #2F3640 · dark: #D7DFEA */
```

Note the dark-mode implication: `--color-ink` must flip meaning between
themes (near-black in light mode, near-white in dark mode) if it's being
used as a text/overlay tint — confirm each of the 5 usages wants "the
darkest available neutral" (in which case alias to a fixed `slate-12-light`
regardless of theme, common for scrim overlays) vs. "the current
foreground colour" (alias to themed `slate-12`) before wiring the fix.
Modal scrims specifically want the fixed variant — a dark overlay should
stay dark even in dark mode.

## Text-on-solid: which step-9 fills take white text

Step 9 solids are not uniformly safe under white text — this is a real
finding from the contrast pass, not a stylistic choice:

| Scale | Light s9 vs white | Dark s9 vs white | White text safe? |
|---|---|---|---|
| Violet | 4.47:1 | 3.88:1 | Light: borderline AA (use for large text/icons only). Dark: icons/large text only. |
| Ember | 3.56:1 | 3.09:1 | Icons/large text only, both themes — **not body text** |
| Moss | 3.77:1 | 3.28:1 | Icons/large text only, both themes |
| Slate | 4.76:1 | 4.13:1 | Light: AA text ok. Dark: icons/large text only. |
| Red | 4.83:1 | 4.17:1 | Light: AA text ok. Dark: icons/large text only. |
| Amber | 3.19:1 | **2.78:1 (fails 3:1 floor)** | Light: icons only. **Dark: use ink text, not white, at any size.** |
| Green | 3.30:1 | **2.88:1 (fails 3:1 floor)** | Light: icons only. **Dark: use ink text, not white, at any size.** |

**Rule:** any solid-fill button/badge using ember, moss, amber or green in
either theme should default to **ink text** (`slate-12` of that theme),
not white, unless the specific step-9 value has been re-checked. Violet
and red solids in light mode are the only pairs safe for white *body*
text; everywhere else, white is icon/large-text-only or wrong outright.
This is exactly the kind of bug a hand-picked hex palette lets through
silently — don't re-introduce it by assuming "brand colour + white text"
is always fine.

## Logo — clear space & minimum size

- **Clear space:** minimum padding equal to the cap-height of the "3" in
  the wordmark, on all sides, before any other element (nav items, page
  edge, adjacent copy).
- **Minimum size:** wordmark not smaller than 16px cap-height in UI
  contexts; glyph mark (once produced) not smaller than 16×16px as a
  favicon, 32×32px anywhere it needs to read at a glance.
- **Never:** stretch, skew, recolour the `3D`/`Verse` split inconsistently
  (the gradient half always leads — it does not move to `Verse`), place on
  a background that drops contrast below AA, or add a drop shadow/bevel.

## Misuse gallery (prose, until an SVG sheet exists)

- Don't recreate the wordmark in a different typeface because Space
  Grotesk isn't loaded yet on some surface — fix the font loading instead.
- Don't use the ember/moss/violet audience accents decoratively on a
  surface that isn't actually about that audience — an admin-only page
  has no audience accent; use slate.
- Don't apply `--animate-layer-line` to anything that isn't a real
  in-progress state (see [03-visual.md](03-visual.md) Motion).
- Don't hard-code a hex value anywhere outside this file and
  `globals.css`. If a value here doesn't have a token yet, that's a gap —
  add the token, don't paste the hex.

## Accessibility summary

- All 14 text steps (11 + 12, across 7 scales) pass their target
  contrast against steps 1–3 of the *same* scale — see the raw numbers in
  the appendix below.
- WCAG AA (4.5:1) is the floor for all body text; AAA (7:1) is achieved by
  every step-12 value, so "high-emphasis text" tokens are AAA by
  construction, not by luck.
- Large text and icons (≥18pt / ≥14pt bold) may use 3:1, which is where
  most step-9 solids land — see the white-text table above before
  defaulting to white.
- Reduced-motion: `globals.css` already guards animation behind
  `prefers-reduced-motion` — keep this when `--animate-layer-line` gains
  new call sites.

### Appendix — raw contrast proof (generation-time output)

```
light violet  s11=4.75:1 AA-ok   s12=11.30:1 AAA-ok
light ember   s11=4.83:1 AA-ok   s12=11.50:1 AAA-ok
light moss    s11=4.51:1 AA-ok   s12=10.90:1 AAA-ok
light slate   s11=4.57:1 AA-ok   s12=11.06:1 AAA-ok
light red     s11=4.91:1 AA-ok   s12=11.50:1 AAA-ok
light amber   s11=4.69:1 AA-ok   s12=11.29:1 AAA-ok
light green   s11=4.51:1 AA-ok   s12=10.92:1 AAA-ok
dark  violet  s11=7.55:1 AA-ok   s12=11.78:1 AAA-ok
dark  ember   s11=7.38:1 AA-ok   s12=11.72:1 AAA-ok
dark  moss    s11=7.81:1 AA-ok   s12=11.80:1 AAA-ok
dark  slate   s11=7.60:1 AA-ok   s12=11.74:1 AAA-ok
dark  red     s11=7.34:1 AA-ok   s12=11.75:1 AAA-ok
dark  amber   s11=7.47:1 AA-ok   s12=11.69:1 AAA-ok
dark  green   s11=7.84:1 AA-ok   s12=11.81:1 AAA-ok

failures: 0
```
