/**
 * Creator "new listing" upload: create the draft, send the file, done.
 * Replaces `isUploading` + `uploadStage` + `uploadProgress`, which stored the
 * same fact twice and declared two stages ("analyzing", "generating") that no
 * code ever entered. Analysis runs in the background after the redirect.
 */

export type UploadState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "uploading"; productId: number; progress: number }
  | { status: "verifying"; productId: number }
  | { status: "ready"; productId: number };

export type UploadEvent =
  | { type: "START" }
  | { type: "CREATED"; hasFile: boolean; productId: number }
  | { type: "PROGRESS"; percent: number }
  | { type: "UPLOADED" }
  | { type: "FAILED" };

export const initialUploadState: UploadState = { status: "idle" };

export function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case "START":
      return state.status === "idle" ? { status: "creating" } : state;
    case "CREATED":
      if (state.status !== "creating") return state;
      return event.hasFile
        ? { status: "uploading", productId: event.productId, progress: 0 }
        : { status: "ready", productId: event.productId };
    case "PROGRESS":
      if (state.status !== "uploading") return state;
      // Once every byte is sent the server is still storing the file.
      return event.percent >= 100
        ? { status: "verifying", productId: state.productId }
        : { ...state, progress: event.percent };
    case "UPLOADED":
      return state.status === "uploading" || state.status === "verifying"
        ? { status: "ready", productId: state.productId }
        : state;
    case "FAILED":
      return state.status === "creating" || state.status === "uploading" || state.status === "verifying"
        ? { status: "idle" }
        : state;
  }
}

export function uploadProgress(state: UploadState): number {
  switch (state.status) {
    case "uploading":
      return state.progress;
    case "verifying":
    case "ready":
      return 100;
    default:
      return 0;
  }
}

export const UPLOAD_LABEL = {
  creating: "Creating listing…",
  uploading: "Uploading...",
  verifying: "Saving on server...",
  ready: "Ready",
} as const;
