/**
 * The audience popup's flow: four steps (about you, what you want, how you buy today, stay in touch).
 * Pure: the component does the saving and dispatches around it.
 *
 * Steps 1-3 save in the background when the visitor presses Next, so they never wait. Only the
 * last step waits for the server, because that is where the visitor leaves an email.
 */
export type AudiencePopupState =
  | { status: "closed" }
  | { status: "open"; step: number; error: string }
  | { status: "submitting" }
  | { status: "done" };

export type AudiencePopupEvent =
  | { type: "OPEN" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SUBMIT" }
  | { type: "SUBMITTED" }
  | { type: "SUBMIT_FAILED"; error: string }
  | { type: "CLOSE" };

export const LAST_STEP = 4;
export const initialAudiencePopupState: AudiencePopupState = { status: "closed" };

export function audiencePopupReducer(state: AudiencePopupState, event: AudiencePopupEvent): AudiencePopupState {
  switch (event.type) {
    case "OPEN":
      return state.status === "closed" ? { status: "open", step: 1, error: "" } : state;
    case "NEXT":
      return state.status === "open" && state.step < LAST_STEP ? { status: "open", step: state.step + 1, error: "" } : state;
    case "BACK":
      return state.status === "open" && state.step > 1 ? { status: "open", step: state.step - 1, error: "" } : state;
    case "SUBMIT":
      return state.status === "open" && state.step === LAST_STEP ? { status: "submitting" } : state;
    case "SUBMITTED":
      return state.status === "submitting" ? { status: "done" } : state;
    case "SUBMIT_FAILED":
      return state.status === "submitting" ? { status: "open", step: LAST_STEP, error: event.error } : state;
    case "CLOSE":
      return state.status === "open" || state.status === "done" ? { status: "closed" } : state;
  }
}
