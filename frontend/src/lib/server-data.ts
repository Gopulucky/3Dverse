import { API_URL } from "@/lib/api";

/**
 * Server-side fetch of the public homepage payload. Returns undefined on any
 * failure so the client falls back to its own fetch instead of the page breaking.
 * Cached for a minute so a burst of visitors costs the API one request.
 */
export async function getHomepageData(): Promise<any | undefined> {
  try {
    const res = await fetch(`${API_URL}/api/marketplace/homepage`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}
