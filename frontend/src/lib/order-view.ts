import { FULFILLMENT_FLOW, isPaidStatus, orderPhase, orderStatusTone, type StatusTone } from "./order-lifecycle";

export type OrderFilter = "all" | "active" | "delivered" | "cancelled";

export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export interface OrderLike {
  id: number;
  status: string;
  items?: { selected_config?: { purchase_type?: string } | null }[];
}

/** An order the buyer is still waiting on, or has not finished paying for, is "active". */
export function orderFilter(status?: string | null): Exclude<OrderFilter, "all"> {
  const phase = orderPhase(status);
  if (phase.kind === "completed") return "delivered";
  if (phase.kind === "closed") return "cancelled";
  if (status === "delivered") return "delivered";
  return "active";
}

export function filterOrders<T extends OrderLike>(orders: T[], filter: OrderFilter): T[] {
  return filter === "all" ? orders : orders.filter((order) => orderFilter(order.status) === filter);
}

export function filterCounts(orders: OrderLike[]): Record<OrderFilter, number> {
  const counts: Record<OrderFilter, number> = { all: orders.length, active: 0, delivered: 0, cancelled: 0 };
  for (const order of orders) counts[orderFilter(order.status)] += 1;
  return counts;
}

export function isDigitalOnly(order: OrderLike): boolean {
  const items = order.items ?? [];
  return items.length > 0 && items.every((item) => item.selected_config?.purchase_type === "digital");
}

export interface OrderHeadline {
  title: string;
  detail: string;
  tone: StatusTone;
  /** Position in the print-and-ship journey; null when there is no journey to show. */
  progress: { step: number; of: number } | null;
}

const PRINTED: Record<string, { title: string; detail: string }> = {
  paid: { title: "Payment confirmed", detail: "Your order is with a print partner soon." },
  queued: { title: "Queued for printing", detail: "A print partner will start on it shortly." },
  printing: { title: "Being printed", detail: "Your item is on the printer now." },
  qc: { title: "Quality check", detail: "We are checking your print before it ships." },
  packed: { title: "Packed", detail: "Packed and waiting for pickup by the courier." },
  shipped: { title: "On the way", detail: "Your order has shipped. Use Track to follow it." },
  delivered: { title: "Delivered", detail: "Your order has arrived." },
  completed: { title: "Delivered", detail: "This order is complete." },
};

/** One plain-language line per order, so the buyer never has to read a status code. */
export function orderHeadline(order: OrderLike): OrderHeadline {
  const status = order.status;
  const phase = orderPhase(status);
  const tone = orderStatusTone(status);
  if (phase.kind === "awaiting_payment") return { title: "Payment pending", detail: "Finish paying to start your order.", tone, progress: null };
  if (phase.kind === "closed") {
    return phase.reason === "cancelled"
      ? { title: "Cancelled", detail: "This order was cancelled.", tone, progress: null }
      : { title: "Payment failed", detail: "You were not charged for this order. Try again from the cart.", tone, progress: null };
  }
  if (isPaidStatus(status) && isDigitalOnly(order)) {
    return { title: "Ready to download", detail: "Your 3D files are ready below.", tone: "success", progress: null };
  }
  const copy = PRINTED[status];
  if (!copy) return { title: status.replace(/_/g, " "), detail: "", tone, progress: null };
  const index = (FULFILLMENT_FLOW as readonly string[]).indexOf(status);
  const done = status === "completed" || status === "delivered";
  return { ...copy, tone, progress: done ? null : { step: index + 1, of: FULFILLMENT_FLOW.length } };
}
