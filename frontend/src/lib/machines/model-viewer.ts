/**
 * 3D model preview: loading -> ready, or an explicit error.
 * Before this, a failed load or an unsupported file left an empty box with no
 * explanation, because the `loaded` flag was set but never shown.
 */

export type ViewerStats = { polyCount: number; vertices: number };

export type ViewerState =
  | { status: "loading" }
  | { status: "ready"; stats: ViewerStats }
  | { status: "error"; reason: "unsupported" | "failed" };

export type ViewerEvent =
  | { type: "LOAD" }
  | { type: "LOADED"; stats: ViewerStats }
  | { type: "FAILED"; reason: "unsupported" | "failed" };

export const initialViewerState: ViewerState = { status: "loading" };

export const SUPPORTED_MODEL_EXTENSIONS = ["stl", "obj", "glb", "gltf"] as const;

/** Lower-case extension of the URL's path; query strings and hashes are ignored. */
export function modelExtension(url: string): string {
  if (!url) return "";
  let pathname: string;
  try {
    pathname = new URL(url, "http://local").pathname;
  } catch {
    return "";
  }
  const name = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 || (dot === 0 && name.length > 1) ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * How the viewer answers a person's hands.
 * - The model turns by itself until someone touches it, then stays still: a
 *   spinning model is impossible to inspect, and it kept turning after a zoom.
 * - Scroll-zoom is live only after a click inside the viewer. Otherwise the
 *   wheel would zoom the model while the shopper is just scrolling down the page.
 */
export type ViewerControls = { autoRotate: boolean; zoomLive: boolean };

export type ControlsEvent =
  | { type: "TOUCH" }
  | { type: "LEAVE" }
  | { type: "TOGGLE_ROTATE" };

/** Reduced-motion users never get the self-spin. */
export function initialControls(reducedMotion: boolean): ViewerControls {
  return { autoRotate: !reducedMotion, zoomLive: false };
}

export function controlsReducer(state: ViewerControls, event: ControlsEvent): ViewerControls {
  switch (event.type) {
    case "TOUCH":
      return !state.autoRotate && state.zoomLive ? state : { autoRotate: false, zoomLive: true };
    case "LEAVE":
      return state.zoomLive ? { ...state, zoomLive: false } : state;
    case "TOGGLE_ROTATE":
      return { ...state, autoRotate: !state.autoRotate };
  }
}

export function viewerReducer(state: ViewerState, event: ViewerEvent): ViewerState {
  switch (event.type) {
    case "LOAD":
      return state.status === "loading" ? state : { status: "loading" };
    case "LOADED":
      return state.status === "loading" ? { status: "ready", stats: event.stats } : state;
    case "FAILED":
      return state.status === "loading" ? { status: "error", reason: event.reason } : state;
  }
}
