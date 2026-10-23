import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, per-user areas: nothing here belongs in search results.
      disallow: [
        "/admin/",
        "/creator/",
        "/partner/",
        "/cart",
        "/checkout",
        "/orders",
        "/settings",
        "/wishlist",
        "/collaboration",
        "/commissions",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
