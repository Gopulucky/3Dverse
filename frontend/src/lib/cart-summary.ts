import { purchasePrice, type ProductCardData } from "./marketplace";

export const MAX_QUANTITY = 100;

export interface CartLine {
  id: number;
  quantity: number;
  selected_config?: { purchase_type?: string } | null;
  product: ProductCardData;
  /** Why the server says this line cannot be bought right now ("Out of stock"); absent when it can. */
  unavailable_reason?: string | null;
}

export interface Discount {
  code: string;
  percent_off?: number | null;
  flat_off?: number | null;
}

export type CartIssue = "mixed_currency" | "non_inr" | "needs_format" | "unavailable" | null;

export interface CartSummary {
  itemCount: number;
  /** null while any line has no valid format/price, so no wrong total is shown. */
  subtotal: number | null;
  discount: number;
  total: number | null;
  currency: string;
  issue: CartIssue;
  /** Lines the server says cannot be bought now; they stay visible but are not priced into the total. */
  unavailableCount: number;
  canCheckout: boolean;
}

export function unitPrice(line: CartLine): number | undefined {
  return purchasePrice(line.product, line.selected_config?.purchase_type);
}

/** Everything the cart's price card and checkout button need, in one place. */
export function summarizeCart(lines: CartLine[], discount: Discount | null): CartSummary {
  const currencies = new Set(lines.map((line) => line.product.currency || "INR"));
  const currency = currencies.values().next().value || "INR";
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const prices = lines.map(unitPrice);
  const unpriced = prices.some((price) => price == null);
  const unavailableCount = lines.filter((line) => !!line.unavailable_reason).length;
  let issue: CartIssue = null;
  if (currencies.size > 1) issue = "mixed_currency";
  else if (lines.length && currency !== "INR") issue = "non_inr";
  else if (unpriced) issue = "needs_format";
  else if (unavailableCount > 0) issue = "unavailable";

  const subtotal = unpriced ? null
    : lines.reduce((sum, line, i) => sum + (line.unavailable_reason ? 0 : (prices[i] as number) * line.quantity), 0);
  let off = 0;
  if (subtotal != null && discount) {
    if (discount.percent_off) off = subtotal * (Math.min(Math.max(discount.percent_off, 0), 100) / 100);
    else if (discount.flat_off) off = Math.max(discount.flat_off, 0);
    off = Math.min(off, subtotal);
  }
  const total = subtotal == null ? null : Math.max(0, subtotal - off);
  return { itemCount, subtotal, discount: off, total, currency, issue, unavailableCount, canCheckout: lines.length > 0 && issue === null };
}

/** The lines as they will be once the server accepts a quantity change. Zero removes the line. */
export function withQuantity(lines: CartLine[], id: number, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.id !== id);
  const next = Math.min(Math.floor(quantity), MAX_QUANTITY);
  return lines.map((line) => (line.id === id ? { ...line, quantity: next } : line));
}
