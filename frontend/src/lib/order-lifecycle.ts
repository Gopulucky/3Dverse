/**
 * Single source of truth for order statuses on the frontend.
 * Mirrors backend/app/models/order.py (UNPAID_STATUSES) and
 * backend/app/api/routers/partner.py (NEXT_STATUS). The test
 * scripts/machines/order-lifecycle.test.mjs fails if either side drifts.
 */

export type OrderStatus = string;

export const FULFILLMENT_FLOW = ["paid", "queued", "printing", "qc", "packed", "shipped", "delivered"] as const;

export const UNPAID_STATUSES: ReadonlySet<string> = new Set(["pending", "pending_payment", "cancelled", "failed"]);

export const PAID_STATUSES: ReadonlySet<string> = new Set([...FULFILLMENT_FLOW, "completed"]);

export const NEXT_STATUS: Readonly<Record<string, string>> = {
  paid: "queued",
  queued: "printing",
  printing: "qc",
  qc: "packed",
  packed: "shipped",
  shipped: "delivered",
};

export const ADMIN_OPEN_STATUSES: ReadonlySet<string> = new Set(["pending", "paid", "queued", "printing"]);

export type OrderPhase =
  | { kind: "awaiting_payment" }
  | { kind: "fulfilment"; index: number }
  | { kind: "completed" }
  | { kind: "closed"; reason: "cancelled" | "failed" }
  | { kind: "unknown" };

export function orderPhase(status?: string | null): OrderPhase {
  if (!status) return { kind: "unknown" };
  if (status === "pending" || status === "pending_payment") return { kind: "awaiting_payment" };
  if (status === "cancelled" || status === "failed") return { kind: "closed", reason: status };
  if (status === "completed") return { kind: "completed" };
  const index = (FULFILLMENT_FLOW as readonly string[]).indexOf(status);
  return index >= 0 ? { kind: "fulfilment", index } : { kind: "unknown" };
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: "Payment confirmed",
  queued: "Queued",
  printing: "Printing",
  qc: "Quality check",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  pending: "Awaiting payment",
  pending_payment: "Awaiting payment",
  cancelled: "Cancelled",
  failed: "Payment failed",
};

export function orderStatusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return ORDER_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export type StatusTone = "success" | "warning" | "in-progress" | "neutral";

export function orderStatusTone(status?: string | null): StatusTone {
  switch (status) {
    case "delivered":
    case "shipped":
    case "completed":
      return "success";
    case "pending":
    case "pending_payment":
    case "queued":
      return "warning";
    case "printing":
    case "qc":
      return "in-progress";
    default:
      return "neutral";
  }
}

export function isPaidStatus(status?: string | null): boolean {
  return !!status && PAID_STATUSES.has(status);
}
