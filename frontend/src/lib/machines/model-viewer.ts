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
