/**
 * What the storefront may promise. The homepage API reports whether payment
 * and printed delivery actually work; until it says so, the page makes no
 * delivery or payment claims. Missing data counts as "not available".
 */
export interface StoreAvailability {
  checkout: boolean;
  printed: boolean;
}

export type TrustKey = "delivery" | "downloads" | "payment";

export function storeAvailability(value: unknown): StoreAvailability {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { checkout: raw.checkout === true, printed: raw.printed === true };
}

export function trustItems(availability: StoreAvailability): { key: TrustKey; label: string }[] {
  const items: { key: TrustKey; label: string }[] = [];
  if (availability.printed) items.push({ key: "delivery", label: "Delivery within India" });
  items.push({ key: "downloads", label: "Digital files unlock after payment" });
  if (availability.checkout) items.push({ key: "payment", label: "Secure payment" });
  return items;
}

export function printedTile(availability: StoreAvailability): { caption: string; comingSoon: boolean } {
  return availability.printed
    ? { caption: "Delivered in India", comingSoon: false }
    : { caption: "Coming soon", comingSoon: true };
}
