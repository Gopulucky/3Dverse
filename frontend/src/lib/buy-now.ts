/**
 * "Buy now": one product goes straight to checkout, separate from the cart.
 * The product page saves the single item here; the checkout page reads it back.
 * Both sides must treat anything unexpected in storage as "no buy-now item".
 */
export type BuyNowItem = {
  product_id: number;
  quantity: 1;
  purchase_type: "digital" | "physical";
  selected_config: Record<string, string>;
};

export const BUY_NOW_PARAM = "buy";
export const BUY_NOW_VALUE = "now";

export function buyNowKey(userId: number | string | undefined): string {
  return `buy-now-${userId}`;
}

function isBuyNowItem(value: unknown): value is BuyNowItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!Number.isInteger(item.product_id) || (item.product_id as number) < 1) return false;
  if (item.quantity !== 1) return false;
  if (item.purchase_type !== "digital" && item.purchase_type !== "physical") return false;
  const config = item.selected_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  return Object.values(config as Record<string, unknown>).every((entry) => typeof entry === "string");
}

export function readBuyNow(storage: Pick<Storage, "getItem">, userId: number | string | undefined): BuyNowItem | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(buyNowKey(userId)) || "null");
    return isBuyNowItem(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBuyNow(storage: Pick<Storage, "setItem">, userId: number | string | undefined, item: BuyNowItem): void {
  try {
    storage.setItem(buyNowKey(userId), JSON.stringify(item));
  } catch { /* storage blocked: checkout will say there is nothing to buy */ }
}

/** The `direct_item` field of the create-payment request, or undefined for a normal cart checkout. */
export function directItemBody(item: BuyNowItem | null): BuyNowItem | undefined {
  return item ?? undefined;
}
