"use client";

import { API_URL } from "@/lib/api";
import { createTracker, type Batch, type TrackEvent, type Visitor } from "@/lib/track";

let tracker: ReturnType<typeof createTracker> | null = null;

function browserTracker() {
  if (tracker) return tracker;
  tracker = createTracker({
    local: window.localStorage,
    session: window.sessionStorage,
    search: window.location.search,
    send: (batch: Batch) => fetch(`${API_URL}/api/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch), keepalive: true,
    }),
  });
  return tracker;
}

/** Record one anonymous step. Safe to call anywhere on the client; does nothing during server rendering. */
export function track(event: TrackEvent, extra?: { productId?: number }): void {
  if (typeof window === "undefined") return;
  try { browserTracker().track(event, { ...extra, path: window.location.pathname }); } catch { /* tracking is best effort */ }
}

export function trackLanding(): void {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
  try { browserTracker().landing(window.location.pathname); } catch { /* tracking is best effort */ }
}

/** Anonymous id and source, sent with the checkout request so a payment can be credited to a channel. */
export function checkoutVisitor(): Visitor | undefined {
  if (typeof window === "undefined") return undefined;
  try { return browserTracker().visitor(); } catch { return undefined; }
}
