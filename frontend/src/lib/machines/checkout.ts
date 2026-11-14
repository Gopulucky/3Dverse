/**
 * Checkout flow, in two parts:
 *  - the page machine (editing details -> preparing the order -> paying), and
 *  - the payment-form machine (paying in Razorpay Checkout -> verifying the order).
 * Pure: the components keep their API/Razorpay calls and dispatch around them.
 */

// ---- Page machine ----------------------------------------------------------

export type CheckoutState<C> =
  | { status: "editing"; error: string }
  | { status: "preparing" }
  | { status: "payment"; checkout: C };

export type CheckoutEvent<C> =
  | { type: "PREPARE" }
  | { type: "PREPARED"; checkout: C }
  | { type: "PREPARE_FAILED"; error: string };

export const initialCheckoutState: CheckoutState<never> = { status: "editing", error: "" };

export function checkoutReducer<C>(state: CheckoutState<C>, event: CheckoutEvent<C>): CheckoutState<C> {
  switch (event.type) {
    case "PREPARE":
      return state.status === "editing" ? { status: "preparing" } : state;
    case "PREPARED":
      return state.status === "preparing" ? { status: "payment", checkout: event.checkout } : state;
    case "PREPARE_FAILED":
      return state.status === "preparing" ? { status: "editing", error: event.error } : state;
  }
}

/**
 * Razorpay order statuses in which the user must not be asked to pay again.
 * "created" and "attempted" (a failed or abandoned try) can still be paid.
 */
export const SUBMITTED_PAYMENT_STATUSES: readonly string[] = ["paid"];

export type CheckoutViewState =
  | "loading"
  | "load-error"
  | "unavailable"
  | "editing"
  | "preparing"
  | "payment"
  | "already-submitted";

/** What the page is showing, in the same priority order as its render logic. */
export function checkoutViewState(args: {
  ready: boolean;
  isPending: boolean;
  isError: boolean;
  paymentsAvailable: boolean;
  state: CheckoutState<{ payment_status: string }>;
}): CheckoutViewState {
  const { ready, isPending, isError, paymentsAvailable, state } = args;
  if (!ready || isPending) return "loading";
  if (isError) return "load-error";
  if (!paymentsAvailable) return "unavailable";
  if (state.status === "payment") {
    return SUBMITTED_PAYMENT_STATUSES.includes(state.checkout.payment_status) ? "already-submitted" : "payment";
  }
  return state.status;
}

// ---- Payment-form machine --------------------------------------------------

export type PaymentState =
  | { status: "idle"; error: string }
  | { status: "confirming" }
  | { status: "verifying" }
  | { status: "confirmed" }
  | { status: "pending" }
  | { status: "unknown" };

export type PaymentEvent =
  | { type: "CONFIRM" }
  | { type: "PROVIDER_ERROR"; error: string }
  | { type: "SUBMITTED" }
  | { type: "VERIFIED" }
  | { type: "TIMED_OUT" }
  | { type: "FAILED" };

export const initialPaymentState: PaymentState = { status: "idle", error: "" };

export function paymentReducer(state: PaymentState, event: PaymentEvent): PaymentState {
  switch (event.type) {
    case "CONFIRM":
      return state.status === "idle" ? { status: "confirming" } : state;
    case "PROVIDER_ERROR":
      return state.status === "confirming" ? { status: "idle", error: event.error } : state;
    case "SUBMITTED":
      return state.status === "confirming" ? { status: "verifying" } : state;
    case "VERIFIED":
      return state.status === "verifying" ? { status: "confirmed" } : state;
    case "TIMED_OUT":
      return state.status === "verifying" ? { status: "pending" } : state;
    case "FAILED":
      return state.status === "confirming" || state.status === "verifying" ? { status: "unknown" } : state;
  }
}

/** Once payment is submitted the card form is hidden. */
export function paymentFinished(state: PaymentState): boolean {
  return state.status !== "idle" && state.status !== "confirming";
}

export const PAYMENT_MESSAGES = {
  verifying: "Payment submitted. Waiting for secure confirmation for your saved order.",
  confirmed: "Payment confirmed. Your order is ready to view.",
  pending: "Your order is saved and payment confirmation is pending. Check Orders for updates before trying another payment.",
  unknown: "We could not confirm the latest payment status. Your order is saved. Check Orders before trying another payment.",
} as const;

export function paymentMessage(state: PaymentState): string {
  switch (state.status) {
    case "idle":
      return state.error;
    case "confirming":
      return "";
    default:
      return PAYMENT_MESSAGES[state.status];
  }
}
