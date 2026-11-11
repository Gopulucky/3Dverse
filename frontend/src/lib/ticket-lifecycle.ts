/**
 * Collaboration ticket statuses on the frontend: one place for labels, tones,
 * inbox grouping and the next action. Mirrors `TicketStatus` in
 * backend/app/models/collaboration.py; scripts/machines/ticket-lifecycle.test.mjs
 * fails if the backend adds a status that is not covered here.
 */

export const TICKET_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Waiting for design",
  design_submitted: "Design received",
  sample_printing: "Printing sample",
  certified: "Quote sent",
  negotiating: "Negotiating",
  agreed: "Agreed",
  rejected: "Declined",
  expired: "Expired",
};

export type TicketTone = "success" | "warning" | "in-progress" | "neutral";

export function ticketLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return TICKET_LABEL[status] ?? status.replace(/_/g, " ");
}

export function ticketTone(status?: string | null): TicketTone {
  switch (status) {
    case "agreed":
      return "success";
    case "pending_payment":
      return "warning";
    case "paid":
    case "design_submitted":
    case "sample_printing":
    case "certified":
    case "negotiating":
      return "in-progress";
    default:
      return "neutral";
  }
}

export type InboxGroup = "action" | "progress" | "closed" | "hidden";

/** Which inbox tab a ticket belongs to. Unpaid tickets are not the partner's yet. */
export function inboxGroup(status?: string | null): InboxGroup {
  switch (status) {
    case "paid":
    case "design_submitted":
    case "sample_printing":
      return "action";
    case "certified":
    case "negotiating":
      return "progress";
    case "agreed":
    case "rejected":
    case "expired":
      return "closed";
    default:
      return "hidden";
  }
}

export type NextAction = "wait" | "accept" | "quote" | null;

export function nextAction(status?: string | null): NextAction {
  switch (status) {
    case "paid":
      return "wait";
    case "design_submitted":
      return "accept";
    case "sample_printing":
      return "quote";
    default:
      return null;
  }
}
