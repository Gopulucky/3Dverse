/**
 * Customer sign-in / registration flow.
 * Replaces the independent `pendingLink`, `legacy`, `busy` and `error` flags,
 * which allowed combinations the UI never meant to reach.
 */

export type AuthMode =
  | { kind: "email" }
  | { kind: "legacy" }
  | { kind: "link"; from: "email" | "legacy" };

export type AuthState = {
  mode: AuthMode;
  status: "idle" | "submitting" | "done";
  error: string;
};

export type AuthEvent =
  | { type: "SUBMIT" }
  | { type: "FAILED"; error: string }
  | { type: "LINK_REQUIRED"; message: string }
  | { type: "TOGGLE_LEGACY" }
  | { type: "DONE" };

export const initialAuthState: AuthState = { mode: { kind: "email" }, status: "idle", error: "" };

/** True for the previous-sign-in mode, including linking started from it. */
export function isLegacy(state: AuthState): boolean {
  return state.mode.kind === "legacy" || (state.mode.kind === "link" && state.mode.from === "legacy");
}

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case "SUBMIT":
      return state.status === "idle" ? { ...state, status: "submitting", error: "" } : state;
    case "FAILED":
      return state.status === "submitting" ? { ...state, status: "idle", error: event.error } : state;
    case "LINK_REQUIRED":
      if (state.status !== "submitting") return state;
      return { mode: { kind: "link", from: isLegacy(state) ? "legacy" : "email" }, status: "idle", error: event.message };
    case "TOGGLE_LEGACY":
      if (state.status !== "idle") return state;
      return { mode: isLegacy(state) ? { kind: "email" } : { kind: "legacy" }, status: "idle", error: "" };
    case "DONE":
      return state.status === "submitting" ? { ...state, status: "done" } : state;
  }
}
