/** Waitlist sign-up form: idle -> submitting -> joined, with a retryable error. */
export type WaitlistState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "joined" }
  | { status: "error"; message: string };

export type WaitlistEvent =
  | { type: "SUBMIT" }
  | { type: "JOINED" }
  | { type: "FAILED"; message: string };

export const initialWaitlistState: WaitlistState = { status: "idle" };

export function waitlistReducer(state: WaitlistState, event: WaitlistEvent): WaitlistState {
  switch (event.type) {
    case "SUBMIT":
      return state.status === "idle" || state.status === "error" ? { status: "submitting" } : state;
    case "JOINED":
      return state.status === "submitting" ? { status: "joined" } : state;
    case "FAILED":
      return state.status === "submitting" ? { status: "error", message: event.message } : state;
    default:
      return state;
  }
}
