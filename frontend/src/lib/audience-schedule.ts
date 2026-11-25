/**
 * When the audience popup may open, and how it stays out of the way afterwards.
 * Pure: the component reads the clock and storage and passes them in.
 */
export const OPEN_DELAY_MS = 15_000;
export const SNOOZE_DAYS_CLOSED = 14;
export const SNOOZE_DAYS_DONE = 365;
export const OPEN_EVENT = "open-audience";

const UNTIL_KEY = "3dv_audience_until";
const VIEWS_KEY = "3dv_audience_views";
const DAY_MS = 86_400_000;

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

/** The popup belongs on the storefront only, never beside checkout, sign-in or the portals. */
export function pageAllowed(pathname: string): boolean {
  return pathname === "/" || pathname === "/marketplace" || pathname.startsWith("/marketplace/");
}

export const isProductPath = (pathname: string): boolean => /^\/marketplace\/[0-9]+\/?$/.test(pathname);

export function shouldOpen(args: { pathname: string; productViews: number; elapsedMs: number; snoozed: boolean }): boolean {
  if (args.snoozed || !pageAllowed(args.pathname)) return false;
  return args.productViews >= 2 || args.elapsedMs >= OPEN_DELAY_MS;
}

/** True until the snooze ends. If storage cannot be read we cannot remember a refusal, so we never nag. */
export function isSnoozed(storage: Reader, now: number): boolean {
  try {
    const until = Number(storage.getItem(UNTIL_KEY));
    return Number.isFinite(until) && until > now;
  } catch {
    return true;
  }
}

export function snooze(storage: Writer, now: number, days: number): void {
  try { storage.setItem(UNTIL_KEY, String(now + days * DAY_MS)); } catch { /* storage blocked: isSnoozed already says "do not open" */ }
}

/** Remember this product page for the session and return how many different product pages have been seen. */
export function addProductView(storage: Reader & Writer, pathname: string): number {
  try {
    const seen: string[] = JSON.parse(storage.getItem(VIEWS_KEY) || "[]");
    const list = Array.isArray(seen) ? seen : [];
    if (isProductPath(pathname) && !list.includes(pathname)) {
      list.push(pathname);
      storage.setItem(VIEWS_KEY, JSON.stringify(list));
    }
    return list.length;
  } catch {
    return 0;
  }
}

/** Open the popup on purpose (for example from a button on the home page). */
export function openAudiencePopup(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}
