import type { NextConfig } from "next";

// Baseline browser-side protections. Deliberately no Content-Security-Policy:
// the app embeds Stripe and WebGL (three.js) content, and a CSP written without
// being able to test every page would break checkout or the 3D viewer.
const securityHeaders = [
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
