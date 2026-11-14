# UI state machines

Each multi-step UI flow keeps its state in one pure module here instead of
several independent `useState` flags. A module exports a discriminated-union
`State`, an `Event`, and a `reducer`; the component calls `useReducer` and
dispatches around its own `await`s.

## Rules

- **Pure.** No React, DOM, `fetch` or `@/lib/api` imports. API calls, Stripe
  calls and storage stay in the component.
- **Ignored events return the same object.** A late response or a double click
  that the current state does not accept changes nothing and does not re-render.
- **`data-flow` / `data-state` are added, never substituted.** Visible text,
  roles and accessible names stay as they were, so existing smoke scripts keep
  working.
- **Test first.** Each module has `scripts/machines/<name>.test.mjs`
  (`npm run test:unit`). `scripts/load-ts.mjs` loads the real TypeScript.

## Machines

| Module | `data-flow` | `data-state` values | Component |
|---|---|---|---|
| `checkout.ts` (page) | `checkout` | `loading`, `load-error`, `unavailable`, `editing`, `preparing`, `payment`, `already-submitted` | `app/checkout/page.tsx` |
| `checkout.ts` (payment form) | `payment` | `idle`, `confirming`, `verifying`, `confirmed`, `pending`, `unknown` | `PaymentForm` in the same file |
| `customer-auth.ts` | `customer-auth` | `idle`, `submitting`, `done`; mode in `data-auth-mode`: `email`, `legacy`, `link` | `components/auth/customer-auth.tsx` |
| `product-upload.ts` | `product-upload` | `idle`, `creating`, `uploading`, `verifying`, `ready` | `app/creator/products/new/page.tsx` |
| `waitlist.ts` | `waitlist` | `idle`, `submitting`, `joined`, `error` | `components/marketplace/home-waitlist.tsx` |
| `search-suggestions.ts` | `search-suggestions` | `closed`, `debouncing`, `open` | `components/layout/navbar.tsx` |
| `model-viewer.ts` | `model-viewer` | `loading`, `ready`, `error` | `components/shared/advanced-3d-viewer.tsx` |
| `../order-lifecycle.ts` | `order-status` | `awaiting_payment`, `fulfilment`, `completed`, `closed`, `unknown` | `app/orders/page.tsx`, `app/orders/[id]/page.tsx` |
| (mobile menu) | `mobile-menu` | `open`, `closed` | `components/layout/navbar.tsx` |
| (day/night switch) | `theme` | `day`, `night` | `components/layout/theme-toggle.tsx` |

## Waiting on a state (Playwright)

```js
await page.locator('[data-flow="checkout"][data-state="payment"]').waitFor();
await page.locator('[data-flow="model-viewer"]:not([data-state="loading"])').waitFor();
const state = await page.locator('[data-flow="payment"]').getAttribute('data-state');
```

## Order statuses

`src/lib/order-lifecycle.ts` is the only frontend list of order statuses. It
mirrors `backend/app/api/routers/partner.py` (`NEXT_STATUS`) and
`backend/app/models/order.py` (`UNPAID_STATUSES`);
`scripts/machines/order-lifecycle.test.mjs` fails if either side changes alone.

## Adding a machine

1. Write `scripts/machines/<name>.test.mjs` first and watch it fail.
2. Add `src/lib/machines/<name>.ts` (state, events, reducer, initial state).
3. Wire the component with `useReducer`; add `data-flow` and `data-state`.
4. Add a row to the table above.
