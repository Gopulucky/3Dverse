# Teal, Tangerine and Porcelain Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Neel/Terracotta/Chalk with Deep teal/Tangerine/Porcelain across tokens, call sites and brand assets.

**Architecture:** Values-only change to the existing `slate-*`/`violet-*`/`ember-*` 12-step scales, plus one new token `--color-ember-foreground` for ink on tangerine fills, and a mechanical `text-ember` -> `text-ember-ink` sweep.

**Tech Stack:** Next.js 16, Tailwind v4 CSS tokens, node:test.

**Spec:** `docs/superpowers/specs/2026-11-14-teal-tangerine-palette-design.md`

## Global Constraints

- Light anchors: violet-9 `#0E5E6F`, ember-9 `#FF7A1A`, slate-1 `#F7F6F2`, slate-12 `#16191D`.
- Dark anchors: violet-9 `#4FC3D4`, ember-9 `#FF8A3D`, slate-1 `#0F1315`, slate-12 `#E4E9EB`.
- Every scale keeps 12 steps in light and dark; moss/red/amber/green untouched.

## Review Focus

- Bare `text-ember` left anywhere renders tangerine text at ~2.5:1 on porcelain; a test greps `src/` for it.
- Solid tangerine with white text (Buy now) fails AA; the test asserts ink-on-ember-9 and ember-10.
- Dark `--store-action-ink` must equal dark slate-1 (existing test).
- Favicon and OG image still showing indigo; grep for old anchors returns nothing outside docs.
- Partner moss vs customer teal stay distinguishable (visual check of portal sidebars).

---

### Task 1: Palette tokens and test

**Files:** Modify `frontend/scripts/machines/brand-palette.test.mjs`, `frontend/src/app/globals.css:52-73,84-133`, `frontend/src/styles/marketplace/tokens.css:25,33,43-63`, `frontend/src/lib/brand.ts:38-41`

- [ ] Update anchor assertions to the Global Constraints values; replace the light "buy now button" check with `atLeast(L.slate[12], L.ember[9], 4.5)` and `atLeast(L.slate[12], L.ember[10], 4.5)`; add test `no bare text-ember in src` (regex `text-ember(?![-\w])`).
- [ ] Run `node --test scripts/machines/brand-palette.test.mjs`: expect FAIL on anchors.
- [ ] Write scales; add `--color-ember-foreground` (light `var(--color-slate-12)`, dark `var(--color-slate-1)`); set `--color-ink` to `#16191D`; update `BRAND_COLORS`.
- [ ] Re-run: only the `text-ember` test still fails.

### Task 2: Call sites and assets

**Files:** 22 files using bare `text-ember`; `frontend/src/app/marketplace/[id]/page.tsx:506`; `frontend/src/app/icon.tsx`; `frontend/src/app/opengraph-image.tsx`; `frontend/design.md`

- [ ] Sed `text-ember` (not followed by `-`/word char) -> `text-ember-ink`.
- [ ] Buy now button: `text-primary-foreground` -> `text-ember-foreground`.
- [ ] Favicon bg -> `#0E5E6F`; OG bg/ink -> `#0F1315`, mark -> `#4FC3D4`, "3D" -> `#FF8A3D`, muted -> `#A2ADB3`.
- [ ] Rewrite design.md palette bullets.
- [ ] `node --test scripts/machines/*.test.mjs`, `npm run build`, ESLint on changed files, marketplace smoke, screenshots light + dark.
