import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

const STATIC_PAGES = ["", "/marketplace", "/about", "/contact", "/privacy", "/terms", "/refund-policy", "/shipping"];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" || path === "/marketplace" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/marketplace" ? 0.9 : 0.5,
  }));

  try {
    const res = await fetch(`${API_URL}/api/marketplace/products?limit=100`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const products: { id: number }[] = await res.json();
      for (const p of products) {
        pages.push({ url: `${SITE_URL}/marketplace/${p.id}`, changeFrequency: "weekly", priority: 0.7 });
      }
    }
  } catch {
    // API unreachable at build/revalidate time: ship the static pages only.
  }
  return pages;
}
