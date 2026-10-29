import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. A per-request nonce (the strictest form) would force
// every page to render dynamically and give up the static/ISR speed-ups, so
// scripts keep 'unsafe-inline' for Next's own bootstrap code. What this still
// buys: no plugins/objects, no <base> hijacking, forms only post to this site,
// the site can't be framed by others, and scripts can only load from this
// origin and Stripe. connect-src/img-src allow any https host because model and
// image files may be served from object storage on a host chosen at deploy time.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com https://apis.google.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${isDev ? " http://localhost:* http://127.0.0.1:*" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https: blob:${isDev ? " http://localhost:* http://127.0.0.1:* ws://localhost:*" : ""}`,
  `frame-src https://js.stripe.com https://hooks.stripe.com https://*.firebaseapp.com https://accounts.google.com${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? ` https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}` : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

// Baseline browser-side protections.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version in an X-Powered-By header.
  poweredByHeader: false,
  compress: true,
  // Import only the icons/charts actually used instead of whole barrel files.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
