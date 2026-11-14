/** Shapes and labels for the admin funnel report (backend: app/services/funnel.py). */
export type FunnelStep = { event: string; count: number; visitors: number };
export type FunnelSource = { source: string; visitors: number; steps: Record<string, number> };
export type FunnelProduct = { product_id: number; title: string; views: number; carts: number; buys: number };
export type FunnelReport = { steps: FunnelStep[]; by_source: FunnelSource[]; by_product: FunnelProduct[] };

export const STEP_LABELS: Record<string, string> = {
  landing: "Visit started",
  product_view: "Viewed a product",
  viewer_opened: "Used the 3D viewer",
  add_to_cart: "Added to cart",
  buy_now: "Pressed Buy Now",
  checkout_started: "Started checkout",
  payment_opened: "Opened the payment window",
  paid: "Paid",
  waitlist_joined: "Joined the waitlist",
};

/** Share of the people who started a visit that reached this step, as a whole percent; null when nobody has visited yet. */
export function shareOfVisitors(visitors: number, landed: number): number | null {
  return landed > 0 ? Math.round((visitors / landed) * 100) : null;
}
