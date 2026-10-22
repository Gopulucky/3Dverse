/**
 * Centralized API client for 3DVerse backend.
 * Replaces all hardcoded http://127.0.0.1:8000 URLs.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const API_URL = API_BASE_URL;

// A hosted backend on a free/low tier goes to sleep and can take a minute to
// wake. Without a timeout the page would sit on its loading skeleton forever;
// without a retry the first visitor after a quiet spell would see an error for a
// request that succeeds seconds later.
const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_DELAYS_MS = [1_000, 2_500]; // up to two retries, GET/HEAD only
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function isIdempotent(method?: string) {
  const m = (method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with a hard timeout, plus a short retry for safe (GET/HEAD) requests
 * when the server is unreachable or answers 502/503/504 (typical while a
 * sleeping backend wakes up). Mutating requests are never retried: repeating a
 * POST could place an order twice.
 */
async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  const canRetry = isIdempotent(init.method);
  const attempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      if (attempt < attempts - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ApiError(
        0,
        timedOut
          ? "The server is taking too long to respond. It may be waking up — please try again in a moment."
          : "Could not reach the server. Check your connection and try again."
      );
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable: the loop always returns or throws on its last attempt.
  throw new ApiError(0, "Request failed.");
}

/**
 * A production build with no NEXT_PUBLIC_API_URL silently talks to the
 * *visitor's own* localhost, which looks like "the marketplace never loads".
 * Fail loudly with a readable message instead.
 */
function assertApiConfigured() {
  if (
    typeof window !== "undefined" &&
    API_BASE_URL.includes("127.0.0.1") &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    throw new ApiError(
      0,
      "This site is not configured with a backend address (NEXT_PUBLIC_API_URL is missing)."
    );
  }
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  assertApiConfigured();
  const { body, params, headers: customHeaders, ...rest } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...customHeaders,
  };

  const response = await fetchWithRetry(url, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = "An error occurred";
    try {
      const errorData = await response.json();
      detail = errorData.detail || JSON.stringify(errorData);
    } catch {
      detail = response.statusText;
    }
    throw new ApiError(response.status, detail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "PATCH", body }),

  delete: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "DELETE", body }),

  // For file uploads (FormData, no JSON content-type)
  upload: <T>(endpoint: string, formData: FormData) => {
    const headers = getAuthHeaders();
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        let detail = "Upload failed";
        try {
          const err = await res.json();
          detail = err.detail || JSON.stringify(err);
        } catch {
          detail = res.statusText;
        }
        throw new ApiError(res.status, detail);
      }
      return res.json() as Promise<T>;
    });
  },

  /**
   * File upload with real byte-level progress. fetch() cannot report upload
   * progress, so this uses XHR — the progress bar reflects what has actually
   * been sent rather than a timer.
   */
  uploadWithProgress: <T>(
    endpoint: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}${endpoint}`);

      const headers = getAuthHeaders() as Record<string, string>;
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          parsed = undefined;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as T);
          return;
        }
        const detail =
          (parsed as { detail?: string } | undefined)?.detail ||
          xhr.statusText ||
          "Upload failed";
        reject(new ApiError(xhr.status, detail));
      };

      // A dropped connection (server restart, proxy timeout, offline) surfaces
      // here. The browser deliberately hides the cause, so say so plainly
      // instead of letting a bare "Failed to fetch" reach the user.
      xhr.onerror = () =>
        reject(
          new ApiError(
            0,
            "Could not reach the server while uploading. Check your connection and try again."
          )
        );
      xhr.ontimeout = () =>
        reject(new ApiError(0, "The upload timed out. Try again, or use a smaller file."));
      xhr.onabort = () => reject(new ApiError(0, "Upload cancelled."));

      xhr.send(formData);
    }),

  /** Get the full URL for a media/upload path */
  mediaUrl: (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path}`;
  },

  /**
   * Fetch a gated file (paid model, invoice, submitted design) and save it.
   * These endpoints require the auth header, so a plain <a href> cannot be used.
   */
  download: async (endpoint: string, filename?: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      let detail = "Download failed";
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch {
        detail = response.statusText;
      }
      throw new ApiError(response.status, detail);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      filename ||
      response.headers
        .get("content-disposition")
        ?.match(/filename="?([^"]+)"?/)?.[1] ||
      "download";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export { ApiError };
