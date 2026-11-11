# Explicit state machines — Wave 1

Status: draft for review · 2026-11-11 · Branch: `feat/website-performance-audit` (to be confirmed before implementation)

## Goal

Replace the implicit state machines in the 3DVerse frontend (state spread across independent `useState` booleans, refs and copied status lists) with small, named, typed state machines. On mobile and desktop alike, every state shown on screen must be reachable, named and testable.

The work must improve:

- **UX:** every flow has a visible state for loading, failure and success; no blank or stuck screens; no wrong status trackers.
- **DX:** impossible combinations cannot type-check, transitions live in one pure function per flow, and each one is unit-tested without a browser.
- **AX (agent experience):** an agent or smoke script can read the current state from `data-state` attributes instead of matching prose, and order statuses have one source that is checked against the backend.

"Without breaking anything" is a hard constraint: API calls, request bodies, idempotency keys, sessionStorage keys, Stripe calls, routes and the accessible names that existing smoke scripts use (e.g. the "Sign in with email" button) stay exactly as they are.

## Non-goals (Wave 2 or never)

- Commission and collaboration workflows, and the simple busy/done actions (download, forgot/reset password, sell, delete account, returns form with `alert()`). Wave 2.
- The auth session store (`stores/auth-store.ts`). It is already protected against stale responses by `sessionGeneration`.
- Backend changes. The backend remains the authority for every server-side lifecycle.
- New dependencies. XState was considered and rejected: too much rewrite and new surface for the benefit.

## Pattern

A pure module per flow in `frontend/src/lib/machines/`:

```ts
export type State = { status: "idle"; error?: string } | { status: "submitting" } | ...;
export type Event = { type: "SUBMIT" } | { type: "FAILED"; error: string } | ...;
export function reducer(state: State, event: Event): State; // returns `state` unchanged for an event the current state does not accept
export const initialState: State;
```

Rules:

1. **Discriminated unions.** Each status carries only the data valid in it (e.g. `checkout` exists only in payment states).
2. **Unaccepted events are ignored.** The reducer returns the same object, so React skips the re-render and a late network response cannot move a flow backwards.
3. **No React, DOM or network imports.** Side effects stay in the component, which dispatches events around its existing `await`s. This keeps every API call byte-for-byte unchanged.
4. **Synchronous re-entry guards stay.** Existing `useRef` double-submit guards (checkout `preparing`/`attempted`) remain. A dispatch is not visible to a second click in the same tick, so the ref is still the guard and the machine is the source of truth for rendering.
5. **`data-state` on the flow's root element**, with the machine's `status` as its value; `role="status"` / `role="alert"` stay on messages.
6. Components use `useReducer(reducer, initialState)`.

Modules are tested in `scripts/state-machines-test.mjs` with `node:test`, using the repo's existing method (transpile TypeScript in memory with `typescript`, no new test dependency). A small `scripts/load-ts.mjs` helper transpiles a module together with its relative imports, so modules can share code (needed for `order-download.ts` → `order-lifecycle.ts`). The test is added to `npm run test:unit`.

## The six machines

### 1. Checkout — `machines/checkout.ts`, `app/checkout/page.tsx`

Page machine:

| State | Data | Entered by |
|---|---|---|
| `editing` | `error?` | initial; `PREPARE_FAILED` |
| `preparing` | — | `PREPARE` (from `editing` only) |
| `payment` | `checkout` | `PREPARED` |

Load state comes from the existing react-query (`isPending` / `isError`), and "payments unavailable" from `stripePromise`. These are combined into the root `data-state`: `loading | load-error | unavailable | editing | preparing | payment | already-submitted` (`already-submitted` = `payment` where `payment_status` is `succeeded | processing | requires_capture`, the existing rule moved into a named selector).

Payment-form machine:

| State | Meaning | Message (unchanged text) |
|---|---|---|
| `idle` | `error?` from Stripe | Stripe error, or none |
| `confirming` | `confirmPayment` in flight | button: "Confirming payment..." |
| `verifying` | polling the order (up to 8 checks) | "Payment submitted. Waiting for secure confirmation…" |
| `confirmed` | `payment_verified_at` seen | "Payment confirmed. Your order is ready to view." |
| `pending` | 8 checks without verification | "Your order is saved and payment confirmation is pending…" |
| `unknown` | exception after submission | "We could not confirm the latest payment status…" |

`finished` becomes the selector `status ∉ {idle, confirming}`. The sessionStorage clearing, coupon clearing, `setItemCount(0)`, `frozenAttempt` and error-driven reset (400/422/409) stay at the same points. Fixes the stray `?` that shows where `·` belongs in the cart item line.

### 2. Customer sign-in — `machines/customer-auth.ts`, `components/auth/customer-auth.tsx`

Replaces `pendingLink × legacy × busy × error`:

- `mode`: `{ kind: "email" } | { kind: "legacy" } | { kind: "link"; from: "email" | "legacy" }`
- `status`: `idle | submitting`, plus `error?`

Events: `SUBMIT`, `GOOGLE`, `FAILED(error)`, `LINK_REQUIRED(message)`, `TOGGLE_LEGACY`, `DONE`. `TOGGLE_LEGACY` from `link` goes to the opposite of `from`, which exactly matches today's `setLegacy(!legacy); setPendingLink(false)` (including the Google-from-legacy → 409 case). Button labels and form fields per mode are unchanged. Root gets `data-state` (`idle|submitting`) and `data-auth-mode`.

### 3. Creator upload — `machines/product-upload.ts`, `app/creator/products/new/page.tsx`

Replaces `isUploading + uploadStage + uploadProgress`:

`idle → creating → uploading{progress} → verifying → ready{productId}`; `FAILED` → `idle`.

- `creating` (draft POST) is new and labelled "Creating listing…". Today this step shows "Uploading..." at 0%.
- `analyzing` / `generating` are removed: they are declared and labelled but no code ever enters them. Analysis already runs in the background after the redirect, which the success toast says.
- With no file, it goes from `creating` to `ready`.
- Drag/drop/input guards use `status === "idle"`; the failure toast and redirect-to-draft behaviour are unchanged.

### 4. Navbar search suggestions — `machines/search-suggestions.ts`, `components/layout/navbar.tsx`

`closed | debouncing{query} | open{query, results, activeIdx}`.

- **Bug fix:** `RESULTS{query}` is accepted only when `query` equals the current query, so a slow response can no longer reopen suggestions after the input is cleared, a selection is made or the user navigates away.
- `ARROW_UP/DOWN` keep `activeIdx` within bounds; `CLOSE` on outside click, Escape, select and submit.
- The 220 ms debounce, 2-character minimum, endpoint and silent failure stay the same.
- The suggestions container gets `data-state`. The mobile menu effect (focus trap, scroll lock, closing at the desktop breakpoint) is already sound and only gains `data-state="open|closed"` on `#mobile-navigation`.

### 5. 3D viewer — `machines/model-viewer.ts`, `components/shared/advanced-3d-viewer.tsx`

`loading | ready{stats} | error{reason: "unsupported" | "failed"}`.

- **Bug fix:** the STL, OBJ and GLTF loaders get their error callbacks. An extension outside `stl/obj/glb/gltf` (read from the URL path, ignoring any query string) goes straight to `error: unsupported`. Today both cases leave an empty box.
- Loading overlay with `role="status"` ("Loading 3D preview…"). The error overlay says plainly that the preview could not be shown, and the rest of the product page still works. The `loaded` flag that is set but never read is removed.
- **Mobile fix:** the toolbar is `opacity-0 group-hover:opacity-100`, so it is invisible on touch screens. It becomes always visible on devices without hover (`[@media(hover:hover)]` variants) and visible on `focus-within` for keyboard users.
- The existing `onLoadedRef` loop fix stays as it is.

### 6. Order lifecycle — `lib/order-lifecycle.ts` (single source)

Today the list is copied in five places (`orders/page.tsx`, `orders/[id]/page.tsx`, `partner/page.tsx`, `admin/orders/page.tsx`, `lib/order-download.ts`), and the orders list uses `"pending"` while the backend creates orders as `"pending_payment"`.

Module contents (mirrors `backend/app/models/order.py` and `NEXT_STATUS` in `backend/app/api/routers/partner.py`):

- `FULFILLMENT_FLOW = ["paid","queued","printing","qc","packed","shipped","delivered"]`
- `UNPAID = {"pending","pending_payment","cancelled","failed"}`; `PAID_STATUSES` = the flow plus `"completed"`
- `NEXT_STATUS`, identical to the backend map
- `orderPhase(status)` → `{ kind: "awaiting_payment" } | { kind: "fulfilment"; index } | { kind: "closed"; reason: "cancelled" | "failed" } | { kind: "unknown" }`
- `ORDER_STATUS_LABEL`, `orderStatusTone(status)`, `isOpenOrder(status)` (keeps the admin "Open" filter's current set)

Uses:

- **Orders list:** the tracker uses the phase. `pending_payment` / `pending` show "Awaiting payment" with the existing "Continue payment" link, and cancelled/failed show a closed note. Today both show a tracker with nothing highlighted. Chip labels become human-readable ("Awaiting payment" instead of `PENDING_PAYMENT`).
- **Order detail, partner and admin:** they import the shared constants, labels and tones, with the same rendering.
- **`order-download.ts`:** uses `PAID_STATUSES`. The behaviour is identical, and the existing test keeps passing.
- **Drift test:** `state-machines-test.mjs` parses `NEXT_STATUS` from `partner.py` and the status set from `order.py`, and fails if the frontend module disagrees. Changing a status on either side without the other then fails `test:unit`.

## AX documentation

- `frontend/src/lib/machines/README.md` lists each machine, its states, the element carrying its `data-state`, and how to wait on it, e.g. `page.locator('[data-flow="checkout"][data-state="payment"]')`.
- A one-line pointer goes in the root `AGENTS.md` under "Project conventions". `frontend/AGENTS.md` has uncommitted user edits and is not touched.

## Testing and verification

- **Unit (TDD, written before each machine):** every transition, ignored events (late response, double submit), selectors, and the `orderPhase` table including legacy `pending` and unknown statuses, plus the backend drift test. Run with `npm run test:unit`.
- **Static:** `npm run build`; ESLint on changed files plus `npm run lint:critical`.
- **Smoke:** `node scripts/marketplace-smoke.mjs http://127.0.0.1:3000` and `scripts/auth-smoke.mjs` against the local dev server. These use intercepted API fixtures and do not verify a real backend or real payments.
- **Browser:** in the preview pane at mobile (375 px) and desktop widths: sign-in mode toggle, search suggestions including clear-while-loading, the viewer's loading and error states and its toolbar on touch, and the orders tracker for an awaiting-payment order (using fixtures).
- **Checkout limit:** checkout is checked with the unit tests, the build and the fixture smoke test only. A real Stripe payment is not exercised, because payments are parked. The recap will say so.

## Risks

| Risk | Mitigation |
|---|---|
| Checkout regression while payments are parked | No change to calls, keys, storage or messages; guards stay; unit tests cover every payment-form outcome |
| Smoke scripts depend on visible text | Accessible names are kept; `data-state` is added, never substituted |
| Frontend/backend order-status drift | Drift test against the Python sources |
| Large diffs in long page files | Only state wiring changes; markup and classes stay except the noted fixes |
