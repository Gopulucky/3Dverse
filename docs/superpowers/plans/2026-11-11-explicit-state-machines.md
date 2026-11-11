# Explicit State Machines (Wave 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace six implicit frontend state machines with typed, pure, tested reducers that expose `data-state` for agents, fixing the bugs the spec lists.

**Architecture:** Each flow gets a dependency-free module in `frontend/src/lib/machines/` (discriminated-union `State`, `Event`, `reducer`, `initialState`, selectors). Components switch to `useReducer` and dispatch around their existing `await`s, so network behavior is unchanged. Order statuses move to one module, `frontend/src/lib/order-lifecycle.ts`, and a test checks it against the backend Python sources.

**Tech Stack:** Next 16.4 / React 19.2 / TypeScript, Tailwind v4, three.js loaders, `node:test` + in-memory `typescript` transpile (Node 22.21).

**Spec:** `docs/superpowers/specs/2026-11-11-explicit-state-machines-design.md`

## Global Constraints

- No new dependencies (runtime or dev).
- API paths, request bodies, idempotency keys, sessionStorage keys (`checkout-attempt-<id>`, `coupon`), Stripe calls, routes: byte-for-byte unchanged.
- Accessible names used by smoke scripts are unchanged, in particular the button "Sign in with email".
- Machine modules import nothing from React, the DOM or `@/lib/api`. A reducer returns the **same object** for an event its current state does not accept.
- Existing `useRef` re-entry guards in checkout (`preparing`, `attempted`) stay.
- Every flow root carries `data-flow="<name>"` and `data-state="<status>"`. `data-state` is added and never replaces visible text or roles.
- Only state wiring changes in page files; markup and classes stay except for the fixes the spec names.
- Do not edit `frontend/AGENTS.md` (it has uncommitted user edits). Do not commit unless the user asks; each task ends with a diff-review checkpoint instead.
- Frontend AGENTS rule: before using any Next API you are unsure of, read `frontend/node_modules/next/dist/docs/`. This plan needs no new Next APIs.

## Review Focus

1. **Late response after the user moved on** (search typed, then cleared, before results arrive). Suggestions must stay closed. Test: Task 5 `ignores stale results`.
2. **Legacy or unknown order status** (`"pending"`, `"refunded"`, `""`, `undefined`). It must render a sensible phase without crashing. Test: Task 1 `orderPhase table`.
3. **Model URL with a query string, or an uppercase extension** (`/m/a.STL?sig=1`). It must load as STL, not report "unsupported". Test: Task 6 `modelExtension`.
4. **Double submit or late failure during checkout** (`PREPARE` while `preparing`, `PREPARE_FAILED` after `PREPARED`). The state must not regress. Test: Task 2 `ignores events out of order`.
5. **Toggling "previous sign-in" while in link mode reached from legacy.** It must return to email mode, as today. Test: Task 3 `toggle from link`.

---

## File map

| File | Responsibility |
|---|---|
| `frontend/scripts/load-ts.mjs` (new) | `loadTs(relPathFromFrontend)` — transpiles a TS module and its relative imports into a temp dir, returns the imported module |
| `frontend/scripts/machines/*.test.mjs` (new) | one `node:test` file per machine |
| `frontend/src/lib/order-lifecycle.ts` (new) | order status single source |
| `frontend/src/lib/machines/{checkout,customer-auth,product-upload,search-suggestions,model-viewer}.ts` (new) | pure machines |
| `frontend/src/lib/machines/README.md` (new) | AX docs |
| `frontend/package.json` | `test:unit` gains `node --test "scripts/machines/*.test.mjs"` |

---

### Task 1: Test loader + order lifecycle + backend drift test

**Files:**
- Create: `frontend/scripts/load-ts.mjs`, `frontend/src/lib/order-lifecycle.ts`, `frontend/scripts/machines/order-lifecycle.test.mjs`
- Modify: `frontend/src/lib/order-download.ts:20`, `frontend/package.json` (`test:unit`)

**Interfaces:**
- Produces:
  - `loadTs(path: string): Promise<module>` — `path` relative to `frontend/`, e.g. `"src/lib/order-lifecycle.ts"`. It rewrites relative `./x` imports to transpiled `./x.mjs` siblings in `os.tmpdir()/3dverse-ts-<hash>/`.
  - `order-lifecycle.ts` exports:
    - `type OrderStatus = string`
    - `FULFILLMENT_FLOW: readonly ["paid","queued","printing","qc","packed","shipped","delivered"]`
    - `UNPAID_STATUSES: ReadonlySet<string>` = `{pending, pending_payment, cancelled, failed}`
    - `PAID_STATUSES: ReadonlySet<string>` = flow ∪ `{completed}`
    - `NEXT_STATUS: Readonly<Record<string,string>>` = `{paid:"queued",queued:"printing",printing:"qc",qc:"packed",packed:"shipped",shipped:"delivered"}`
    - `type OrderPhase = {kind:"awaiting_payment"} | {kind:"fulfilment"; index:number} | {kind:"completed"} | {kind:"closed"; reason:"cancelled"|"failed"} | {kind:"unknown"}`
    - `orderPhase(status?: string|null): OrderPhase`
    - `ORDER_STATUS_LABEL: Record<string,string>` = paid "Payment confirmed", queued "Queued", printing "Printing", qc "Quality check", packed "Packed", shipped "Shipped", delivered "Delivered", completed "Completed", pending "Awaiting payment", pending_payment "Awaiting payment", cancelled "Cancelled", failed "Payment failed"
    - `orderStatusLabel(status?: string|null): string` (falls back to the raw status with `_` → space, or "Unknown")
    - `type StatusTone = "success"|"warning"|"in-progress"|"neutral"`
    - `orderStatusTone(status?: string|null): StatusTone` — delivered/shipped/completed → success; pending/pending_payment/queued → warning; printing/qc → in-progress; else neutral
    - `ADMIN_OPEN_STATUSES: ReadonlySet<string>` = `{pending, paid, queued, printing}`
    - `isPaidStatus(status?: string|null): boolean`

- [ ] **Step 1: Write failing tests** in `scripts/machines/order-lifecycle.test.mjs`:

```js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import { loadTs } from '../load-ts.mjs';
const m = await loadTs('src/lib/order-lifecycle.ts');
test('orderPhase table', () => {
  assert.deepEqual(m.orderPhase('pending_payment'), { kind: 'awaiting_payment' });
  assert.deepEqual(m.orderPhase('pending'), { kind: 'awaiting_payment' });
  assert.deepEqual(m.orderPhase('paid'), { kind: 'fulfilment', index: 0 });
  assert.deepEqual(m.orderPhase('delivered'), { kind: 'fulfilment', index: 6 });
  assert.deepEqual(m.orderPhase('completed'), { kind: 'completed' });
  assert.deepEqual(m.orderPhase('cancelled'), { kind: 'closed', reason: 'cancelled' });
  assert.deepEqual(m.orderPhase('failed'), { kind: 'closed', reason: 'failed' });
  for (const s of ['refunded', '', undefined, null]) assert.deepEqual(m.orderPhase(s), { kind: 'unknown' });
});
test('labels and tones', () => {
  assert.equal(m.orderStatusLabel('pending_payment'), 'Awaiting payment');
  assert.equal(m.orderStatusLabel('on_hold'), 'on hold');
  assert.equal(m.orderStatusLabel(undefined), 'Unknown');
  assert.equal(m.orderStatusTone('shipped'), 'success');
  assert.equal(m.orderStatusTone('queued'), 'warning');
  assert.equal(m.orderStatusTone('qc'), 'in-progress');
  assert.equal(m.orderStatusTone('cancelled'), 'neutral');
});
test('NEXT_STATUS matches backend partner.py', () => {
  const py = readFileSync(new URL('../../../backend/app/api/routers/partner.py', import.meta.url), 'utf8');
  const body = py.match(/NEXT_STATUS\s*=\s*\{([^}]*)\}/s)[1];
  const backend = Object.fromEntries([...body.matchAll(/"(\w+)"\s*:\s*"(\w+)"/g)].map((x) => [x[1], x[2]]));
  assert.deepEqual({ ...m.NEXT_STATUS }, backend);
});
test('UNPAID_STATUSES matches backend order.py', () => {
  const py = readFileSync(new URL('../../../backend/app/models/order.py', import.meta.url), 'utf8');
  const backend = [...py.match(/UNPAID_STATUSES\s*=\s*\{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual([...m.UNPAID_STATUSES].sort(), backend);
});
test('flow is NEXT_STATUS chain', () => {
  for (let i = 0; i < m.FULFILLMENT_FLOW.length - 1; i++) assert.equal(m.NEXT_STATUS[m.FULFILLMENT_FLOW[i]], m.FULFILLMENT_FLOW[i + 1]);
});
```

- [ ] **Step 2: Run, expect failure** — `cd frontend && node --test "scripts/machines/*.test.mjs"` → FAIL (`load-ts.mjs` / module missing).
- [ ] **Step 3: Implement `scripts/load-ts.mjs`, then `src/lib/order-lifecycle.ts`** per the Interfaces block. The loader uses `ts.transpileModule` (ESNext, ES2020), recursing on `from "./…"` imports. Transpile output goes in a temp dir keyed by the source path hash, so repeated runs don't collide.
- [ ] **Step 4: Make `order-download.ts` use `isPaidStatus(order.status)`** in place of its inline list (`import { isPaidStatus } from "./order-lifecycle"`). Switch `scripts/order-download-test.mjs` to `const { canDownloadModel } = await loadTs('src/lib/order-download.ts')`, because data-URL import cannot resolve the new relative import. Keep its assertions.
- [ ] **Step 5: Append ` && node --test "scripts/machines/*.test.mjs"` to `test:unit`.** Run `npm run test:unit` → all PASS, including the original order-download assertions.
- [ ] **Step 6: Checkpoint** — `git diff --stat`; confirm only listed files changed.

---

### Task 2: Order lifecycle in the UI

**Files:**
- Modify: `frontend/src/app/orders/page.tsx` (`ORDER_STATUS_FLOW`, `OrderStatusTracker`, `getStatusType`, chip label), `frontend/src/app/orders/[id]/page.tsx` (`STATUS_FLOW` timeline), `frontend/src/app/partner/page.tsx` (`STATUS_FLOW`, `STATUS_LABEL`, `getStatusType`), `frontend/src/app/admin/orders/page.tsx` (`OPEN_STATUSES`)

**Interfaces:**
- Consumes: Task 1 `orderPhase`, `FULFILLMENT_FLOW`, `orderStatusLabel`, `orderStatusTone`, `ADMIN_OPEN_STATUSES`, `NEXT_STATUS`.

- [ ] **Step 1: Orders list.** `OrderStatusTracker` switches on `orderPhase(status)`:
  - `fulfilment` / `completed`: the existing pill tracker over `FULFILLMENT_FLOW`, with labels from `orderStatusLabel`; `completed` marks every step as past.
  - `awaiting_payment`: one warning pill "Awaiting payment".
  - `closed`: a muted pill with `orderStatusLabel(status)`.
  - `unknown`: render nothing (same as today).

  The tracker root gets `data-flow="order-status" data-state={phase.kind}`. Replace `getStatusType` with `orderStatusTone` and the chip label `order.status?.toUpperCase()` with `orderStatusLabel(order.status)`.
- [ ] **Step 2: Order detail.** Replace the local `STATUS_FLOW` with `FULFILLMENT_FLOW` and the heading text `status.replace('qc', …)` with `orderStatusLabel(status)`. When the phase is not `fulfilment`/`completed`, show one line above the timeline: "Awaiting payment" (with the existing `/checkout?order_id=` link if `pending_payment`) or the closed label. Timeline root gets `data-flow="order-status" data-state={phase.kind}`.
- [ ] **Step 3: Partner.** Keep the partner's own displayed step list `FULFILLMENT_FLOW.slice(1)` (it starts at `queued` today). Replace `STATUS_LABEL[x]` with `orderStatusLabel(x)` and `getStatusType` with `orderStatusTone`. Shipped now shows the success tone, as on the customer side. The "Add to print queue / Accept job" button computes its target with `NEXT_STATUS[job.status]`; the targets are the same values as today.
- [ ] **Step 4: Admin.** `OPEN_STATUSES.includes(x)` → `ADMIN_OPEN_STATUSES.has(x)`.
- [ ] **Step 5: Verify** — `npx eslint` on the 4 files → 0 errors; `npm run build` → success.
- [ ] **Step 6: Checkpoint** — review the diff; no API or route strings changed (`git diff | grep -E "api\.(get|post|put)"` shows no changed lines).

---

### Task 3: Customer sign-in machine

**Files:**
- Create: `frontend/src/lib/machines/customer-auth.ts`, `frontend/scripts/machines/customer-auth.test.mjs`
- Modify: `frontend/src/components/auth/customer-auth.tsx:26-29, 52-92, 105-115`

**Interfaces:**
- Produces:
  - `type AuthMode = {kind:"email"} | {kind:"legacy"} | {kind:"link"; from:"email"|"legacy"}`
  - `type AuthState = {mode: AuthMode; status: "idle"|"submitting"|"done"; error: string}`
  - `type AuthEvent = {type:"SUBMIT"} | {type:"FAILED"; error:string} | {type:"LINK_REQUIRED"; message:string} | {type:"TOGGLE_LEGACY"} | {type:"DONE"}` (Google uses `SUBMIT`)
  - `initialAuthState: AuthState` (email, idle, "")
  - `authReducer(state, event): AuthState`
  - `isLegacy(state): boolean` — mode is legacy, or link from legacy (drives the toggle label and the forgot-password `?previous=1` link exactly as `legacy` does today)

- [ ] **Step 1: Write failing tests:**
  - `SUBMIT` from idle → submitting, error ""
  - `SUBMIT` while submitting → same object
  - `FAILED` → idle with error
  - `LINK_REQUIRED` from email → `{kind:"link",from:"email"}`, idle, error = message
  - `LINK_REQUIRED` from legacy → `from:"legacy"`
  - **toggle from link**: link from legacy → email; link from email → legacy
  - toggle email ↔ legacy clears error
  - `TOGGLE_LEGACY` while submitting → same object (the button is disabled today)
  - `DONE` → status done
  - `isLegacy` for all four mode shapes
- [ ] **Step 2: Run** `node --test scripts/machines/customer-auth.test.mjs` → FAIL.
- [ ] **Step 3: Implement the module.**
- [ ] **Step 4: Wire the component.** `useReducer(authReducer, initialAuthState)` replaces `pendingLink`, `legacy`, `busy`, `error`.
  - The branches in `submit` test `mode.kind === "link"` and `isLegacy(state)` in the same order as today.
  - The password-mismatch path dispatches `FAILED("Your passwords don’t match.")`.
  - `completeFirebase` dispatches `LINK_REQUIRED` with the existing message.
  - `finish` dispatches `DONE`.
  - `busy` = `status !== "idle"`.

  Add `data-flow="customer-auth" data-state={status} data-auth-mode={mode.kind}` on the form. Labels and texts are unchanged.
- [ ] **Step 5: Run** the unit tests → PASS; `npx eslint src/components/auth/customer-auth.tsx src/lib/machines/customer-auth.ts` → clean.
- [ ] **Step 6: Checkpoint.**

---

### Task 4: Checkout machines

**Files:**
- Create: `frontend/src/lib/machines/checkout.ts`, `frontend/scripts/machines/checkout.test.mjs`
- Modify: `frontend/src/app/checkout/page.tsx` (`PaymentForm` state at 43-45, `CheckoutPage` state at 101-102 + `checkout`, render conditions, the `?` → `·` in the cart line ~171)

**Interfaces:**
- Produces:
  - `type CheckoutState<C> = {status:"editing"; error:string} | {status:"preparing"} | {status:"payment"; checkout:C}`
  - `type CheckoutEvent<C> = {type:"PREPARE"} | {type:"PREPARED"; checkout:C} | {type:"PREPARE_FAILED"; error:string}`
  - `checkoutReducer`, `initialCheckoutState` (`editing`, "")
  - `SUBMITTED_PAYMENT_STATUSES = ["succeeded","processing","requires_capture"]`
  - `checkoutViewState(args:{ready:boolean; isPending:boolean; isError:boolean; paymentsAvailable:boolean; state:CheckoutState<{payment_status:string}>}): "loading"|"load-error"|"unavailable"|"editing"|"preparing"|"payment"|"already-submitted"` — checked in that priority order, mirroring the render ternary
  - `type PaymentState = {status:"idle"; error:string} | {status:"confirming"} | {status:"verifying"} | {status:"confirmed"} | {status:"pending"} | {status:"unknown"}`
  - `type PaymentEvent = {type:"CONFIRM"} | {type:"STRIPE_ERROR"; error:string} | {type:"SUBMITTED"} | {type:"VERIFIED"} | {type:"TIMED_OUT"} | {type:"FAILED"}`
  - `paymentReducer`, `initialPaymentState`, `paymentFinished(s): boolean` (status ∉ idle/confirming), `PAYMENT_MESSAGES: Record<"verifying"|"confirmed"|"pending"|"unknown", string>` holding the four existing strings verbatim from `page.tsx:62,68,73,76`
  - `paymentMessage(s): string` (idle → its error, confirming → "")

- [ ] **Step 1: Write failing tests:**
  - happy path editing→preparing→payment
  - `PREPARE_FAILED` → editing with error
  - **ignores events out of order**: `PREPARE` while preparing → same object; `PREPARE_FAILED` / `PREPARED` while in payment → same object
  - payment: idle→confirming→verifying→confirmed; `TIMED_OUT` from verifying → pending; `FAILED` from confirming or verifying → unknown; `STRIPE_ERROR` from confirming → idle with error; `CONFIRM` from verifying → same object
  - `paymentFinished` truth table
  - `checkoutViewState` table: not ready → loading; isError → load-error; !paymentsAvailable → unavailable; payment with `processing` → already-submitted; payment with `requires_payment_method` → payment
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the module.**
- [ ] **Step 4: Wire `PaymentForm`.** Dispatch:
  - `CONFIRM` where `setBusy(true)` was
  - `STRIPE_ERROR` on `result.error` (`attempted.current = false` stays)
  - `SUBMITTED` before the polling loop
  - `VERIFIED` on verification (sessionStorage removals stay just before it)
  - `TIMED_OUT` after the loop
  - `FAILED` in `catch`

  Render `{!paymentFinished(s) && <PaymentElement/>}`, the message from `paymentMessage`, and button busy = `status === "confirming" || status === "verifying"` (today `busy` stays true through polling). Form gets `data-flow="payment" data-state={status}`.
- [ ] **Step 5: Wire `CheckoutPage`.** `useReducer` replaces `checkout`, `busy`, `error`. `prepare()` dispatches `PREPARE` / `PREPARED` / `PREPARE_FAILED`. The resume POST path dispatches `PREPARED` too. `preparing` ref, `frozenAttempt`, sessionStorage and `setItemCount` stay in place. Render conditions read `state.status` and the `checkout` from the `payment` variant. `<main>` gets `data-flow="checkout" data-state={checkoutViewState(...)}`. Fix `?` → `·` in the cart item line.
- [ ] **Step 6: Run** unit tests → PASS; eslint on both files → clean; `npm run lint:critical` → clean.
- [ ] **Step 7: Checkpoint** — `git diff src/app/checkout/page.tsx | grep -E "^[-+].*(api\.|sessionStorage|confirmPayment|idempotency)"`. The only changed lines are moved ones, with identical text.

---

### Task 5: Navbar search suggestions

**Files:**
- Create: `frontend/src/lib/machines/search-suggestions.ts`, `frontend/scripts/machines/search-suggestions.test.mjs`
- Modify: `frontend/src/components/layout/navbar.tsx:50-83, 337-410`, mobile panel `#mobile-navigation`

**Interfaces:**
- Produces:
  - `type Suggestion = {type:"category"; label:string} | {type:"product"; label:string; sub:string; price:number; id:number; currency?:string}`
  - `type SearchState = {status:"closed"; query:string} | {status:"debouncing"; query:string} | {status:"open"; query:string; items:Suggestion[]; activeIdx:number}`
  - `type SearchEvent = {type:"INPUT"; query:string} | {type:"RESULTS"; query:string; items:Suggestion[]} | {type:"ARROW"; dir:1|-1} | {type:"CLOSE"}`
  - `searchReducer`, `initialSearchState` (`closed`, "")
  - `MIN_QUERY = 2`
  - `toSuggestions(data:{products:{id:number;title:string;category:string;price:number;currency?:string}[]; categories:string[]}): Suggestion[]` (categories first, same as today's `allSuggestions`)
  - `activeSuggestion(s): Suggestion | null`

- [ ] **Step 1: Write failing tests:**
  - `INPUT "a"` → closed
  - `INPUT "ab"` → debouncing
  - `RESULTS` matching → open with activeIdx -1
  - **ignores stale results**: `INPUT "ab"`, `INPUT ""`, `RESULTS{query:"ab"}` → still closed with query ""
  - `RESULTS` for a different query while debouncing → same object
  - `RESULTS` with 0 items → closed
  - `ARROW` clamps to [-1, len-1]; `ARROW` when closed → same object
  - `CLOSE` keeps the query
  - `toSuggestions` ordering
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the module.** Query comparison uses the trimmed query.
- [ ] **Step 4: Wire the navbar.** `searchQuery` text stays its own `useState` (it is input-controlled; the machine tracks the query it is waiting on). `onChange` dispatches `INPUT`, and the 220 ms timer fetches and then dispatches `RESULTS{query: value.trim()}`. The outside-click handler, Escape, select and `handleSearch` dispatch `CLOSE`. Category clicks also set the query to "" (as today) and dispatch `INPUT ""`. The dropdown renders when `status === "open"`, and the search wrapper `div` gets `data-flow="search-suggestions" data-state={status}`. Add `data-state={mobileOpen ? "open" : "closed"}` to `#mobile-navigation`.
- [ ] **Step 5: Run** unit tests → PASS; eslint navbar + module → clean.
- [ ] **Step 6: Checkpoint.**

---

### Task 6: 3D viewer machine + touch toolbar

**Files:**
- Create: `frontend/src/lib/machines/model-viewer.ts`, `frontend/scripts/machines/model-viewer.test.mjs`
- Modify: `frontend/src/components/shared/advanced-3d-viewer.tsx` (Model loader at ~35-110, `loaded`/`stats` state at 134-135, HUD, toolbar class at ~185)

**Interfaces:**
- Produces:
  - `type ViewerStats = {polyCount:number; vertices:number}`
  - `type ViewerState = {status:"loading"} | {status:"ready"; stats:ViewerStats} | {status:"error"; reason:"unsupported"|"failed"}`
  - `type ViewerEvent = {type:"LOAD"} | {type:"LOADED"; stats:ViewerStats} | {type:"FAILED"; reason:"unsupported"|"failed"}`
  - `viewerReducer`, `initialViewerState` (loading)
  - `SUPPORTED_MODEL_EXTENSIONS = ["stl","obj","glb","gltf"]`
  - `modelExtension(url:string): string` (lowercase; path only; no query/hash; "" if none)

- [ ] **Step 1: Write failing tests:**
  - **modelExtension**: `"/m/a.STL?sig=1"` → `"stl"`; `"https://x.test/p/model.glb#v"` → `"glb"`; `"/m/noext"` → `""`; `"/a.b/c"` → `""`
  - loading→ready with stats
  - `FAILED` → error with reason
  - `LOADED` while error → same object
  - `LOAD` from ready/error → loading (URL change)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the module.** `modelExtension` parses with `new URL(url, "http://local")`.
- [ ] **Step 4: Wire the component.**
  - The parent viewer owns `useReducer(viewerReducer, …)`.
  - The `Model` child receives `onLoaded` and a new `onError(reason)`, kept in refs like the existing `onLoadedRef`.
  - Its effect dispatches `LOAD` (via a parent callback ref) when the url changes. It uses `modelExtension(url)`: unsupported → `onError("unsupported")`; every `loader.load` gets a 4th-argument error callback → `onError("failed")`.
  - HUD stats read from the `ready` state; delete `loaded` / `stats` useState.
  - Overlays, centered, `absolute inset-0 z-10`:
    - loading → `role="status"`, spinner + "Loading 3D preview…"
    - error → `role="alert"`: "This 3D preview can't be shown." plus "unsupported" → "This file format can't be previewed in the browser." / "failed" → "The preview didn't load. Refresh to try again."
  - The container gets `data-flow="model-viewer" data-state={status}`.
  - Toolbar classes: `opacity-0 group-hover:opacity-100` → `opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100`.
- [ ] **Step 5: Run** unit tests → PASS; eslint on both files → clean.
- [ ] **Step 6: Checkpoint.**

---

### Task 7: Creator upload machine

**Files:**
- Create: `frontend/src/lib/machines/product-upload.ts`, `frontend/scripts/machines/product-upload.test.mjs`
- Modify: `frontend/src/app/creator/products/new/page.tsx:92-96, 98-125, 162-238, 378-420, 482-518`

**Interfaces:**
- Produces:
  - `type UploadState = {status:"idle"} | {status:"creating"} | {status:"uploading"; productId:number; progress:number} | {status:"verifying"; productId:number} | {status:"ready"; productId:number}`
  - `type UploadEvent = {type:"START"} | {type:"CREATED"; hasFile:boolean; productId:number} | {type:"PROGRESS"; percent:number} | {type:"UPLOADED"} | {type:"FAILED"}`
  - `uploadReducer`, `initialUploadState`
  - `uploadProgress(s): number` (idle/creating 0, uploading its progress, verifying/ready 100)
  - `UPLOAD_LABEL: Record<Exclude<UploadState["status"],"idle">,string>` = creating "Creating listing…", uploading "Uploading...", verifying "Saving on server...", ready "Ready"

- [ ] **Step 1: Write failing tests:**
  - `START` → creating
  - `CREATED{hasFile:true}` → uploading 0
  - `CREATED{hasFile:false,productId:7}` → ready 7
  - `PROGRESS 40` → uploading 40
  - `PROGRESS 100` → verifying
  - `PROGRESS` while verifying → same object
  - `UPLOADED` from verifying or uploading → ready, with the productId from `CREATED`
  - `FAILED` from any busy state → idle
  - `START` while creating → same object
  - `uploadProgress` table
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the module.**
- [ ] **Step 4: Wire the page.** The reducer replaces `isUploading`, `uploadStage`, `uploadProgress`. Guards become `state.status !== "idle"`. `handleSubmit` dispatches `START` → `CREATED` → `PROGRESS` (from the `uploadWithProgress` callback) → `UPLOADED` → existing toast + `router.push`; `catch` dispatches `FAILED` and keeps its toast/redirect logic. Progress UI uses `UPLOAD_LABEL[status]` and `uploadProgress(state)`. The progress container gets `data-flow="product-upload" data-state={status}`.
- [ ] **Step 5: Run** unit tests → PASS; eslint → clean.
- [ ] **Step 6: Checkpoint.**

---

### Task 8: AX docs + full verification

**Files:**
- Create: `frontend/src/lib/machines/README.md`
- Modify: `AGENTS.md` (root), one bullet under "Project conventions and verification"

- [ ] **Step 1: README.** A table with one row per machine: module, `data-flow`, states, owning component. It also covers the rules from Global Constraints (pure, same object on ignored event, `data-state` added not substituted), a Playwright wait example `page.locator('[data-flow="checkout"]').getAttribute('data-state')`, and a note that `order-lifecycle.ts` is checked against the backend by `scripts/machines/order-lifecycle.test.mjs`.
- [ ] **Step 2: Root AGENTS.md bullet:** "UI flow state lives in `frontend/src/lib/machines/` (see its README); read `data-flow`/`data-state` attributes instead of matching copy. Order statuses: `frontend/src/lib/order-lifecycle.ts` only."
- [ ] **Step 3: Static checks** (from `frontend/`):
  - `npm run test:unit` → all pass
  - `npm run lint:critical` → clean
  - `npx eslint` on every changed/created file → 0 errors
  - `npm run build` → success
- [ ] **Step 4: Smoke** — start the dev server via the preview tool (`.claude/launch.json` `npm run dev`, port 3000), then run `node scripts/marketplace-smoke.mjs http://127.0.0.1:3000` and `node scripts/auth-smoke.mjs http://127.0.0.1:3000` → pass.
- [ ] **Step 5: Browser checks** at 375×812 and desktop:
  - login page: toggle previous sign-in; `data-auth-mode` flips
  - navbar search: type "ve", clear immediately; dropdown stays closed (`data-state="closed"`)
  - product page viewer: `data-state` reaches `ready`, or shows the error overlay; toolbar visible at mobile width
  - checkout page `data-state` reads `loading` → `editing` (fixtures)

  Screenshot proof.
- [ ] **Step 6: Backend unchanged** — `git diff --stat -- backend` is empty, so backend pytest is not required. Note this in the report.
- [ ] **Step 7: Final review** — `git diff`; request code review (superpowers:requesting-code-review); report results and limits (no real Stripe, fixture-only smoke).
