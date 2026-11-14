/**
 * Anonymous funnel tracking: a random visitor id and the link the visitor arrived from,
 * attached to the steps they take. No email, name or account id ever goes in here.
 * Everything is best effort: tracking must never throw into, or slow down, the page.
 *
 * Event names must match backend/app/schemas/funnel.py (`checkout_started` and `paid`
 * are recorded by the server, never by the browser).
 */
export type TrackEvent = "landing" | "product_view" | "viewer_opened" | "add_to_cart" | "buy_now" | "payment_opened" | "waitlist_joined";

export type Source = { source: string | null; medium: string | null; campaign: string | null };
export type Visitor = Source & { anon_id: string };
export type Batch = {
  anon_id: string;
  events: { event: TrackEvent; product_id: number | null; source: string | null; medium: string | null; campaign: string | null; path: string | null }[];
};

type Store = Pick<Storage, "getItem" | "setItem">;

const TAG = /^[A-Za-z0-9_.-]{1,64}$/;
const ID_KEY = "3dv_visitor";
const SOURCE_KEY = "3dv_source";
const LANDED_KEY = "3dv_landed";

const clean = (value: string | null): string | null => (value && TAG.test(value) ? value : null);

/** `?src=` wins over `utm_source`; anything that is not a short plain tag is dropped. */
export function parseSource(search: string): Source {
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return { source: null, medium: null, campaign: null }; }
  return {
    source: clean(params.get("src")) ?? clean(params.get("utm_source")),
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
  };
}

export function newAnonId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeGet(store: Store, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Store, key: string, value: string): void {
  try { store.setItem(key, value); } catch { /* storage blocked: carry on without it */ }
}

export function createTracker(deps: { local: Store; session: Store; search: string; send: (batch: Batch) => unknown }) {
  let fallbackId: string | null = null; // used when storage is blocked, so one page still has one id

  function anonId(): string {
    const saved = safeGet(deps.local, ID_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
    const made = fallbackId ?? newAnonId();
    fallbackId = made;
    safeSet(deps.local, ID_KEY, made);
    return made;
  }

  /** First touch: the earliest source we saw for this visitor is kept; later links do not overwrite it. */
  function source(): Source {
    try {
      const saved = JSON.parse(safeGet(deps.local, SOURCE_KEY) || "null") as Partial<Source> | null;
      if (saved && clean(saved.source ?? null)) return { source: clean(saved.source ?? null), medium: clean(saved.medium ?? null), campaign: clean(saved.campaign ?? null) };
    } catch { /* fall through to the current link */ }
    const found = parseSource(deps.search);
    if (found.source) safeSet(deps.local, SOURCE_KEY, JSON.stringify(found));
    return found;
  }

  function visitor(): Visitor {
    return { anon_id: anonId(), ...source() };
  }

  function track(event: TrackEvent, extra: { productId?: number; path?: string } = {}): void {
    try {
      const who = visitor();
      const batch: Batch = {
        anon_id: who.anon_id,
        events: [{ event, product_id: extra.productId ?? null, source: who.source, medium: who.medium, campaign: who.campaign, path: extra.path?.slice(0, 200) ?? null }],
      };
      const result = deps.send(batch);
      if (result && typeof (result as Promise<unknown>).catch === "function") (result as Promise<unknown>).catch(() => {});
    } catch { /* never let tracking reach the page */ }
  }

  /** The first page of a browsing session. */
  function landing(path: string): void {
    if (safeGet(deps.session, LANDED_KEY)) return;
    safeSet(deps.session, LANDED_KEY, "1");
    track("landing", { path });
  }

  return { track, landing, visitor };
}
