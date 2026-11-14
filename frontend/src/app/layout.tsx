import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { preconnect } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import { FunnelLanding } from "@/components/analytics/funnel-landing";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND } from "@/lib/brand";
import { API_URL } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://3dverse.com";

// Brand fonts are self-hosted (latin + latin-ext, which includes ₹) so the
// build never depends on Google Fonts. Files and OFL licences live in
// ./fonts; regenerate with scripts/fonts/build_fonts.py.

// Display — headlines, hero numbers, section titles (variable 500–700)
const spaceGrotesk = localFont({
  src: [{ path: "./fonts/SpaceGrotesk-500-700.woff2", weight: "500 700", style: "normal" }],
  variable: "--font-space-grotesk",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

// Body — paragraphs, UI labels, buttons, nav (variable 400–700)
const ibmPlexSans = localFont({
  src: [{ path: "./fonts/IBMPlexSans-400-700.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-ibm-plex-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

// Utility / data — prices, dimensions, order IDs, job IDs
const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
  // Only prices/IDs use it; don't spend first-paint bandwidth preloading it.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.positioning}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.oneLiner,
  keywords: [
    "3D printing",
    "marketplace",
    "3D models",
    "STL files",
    "print on demand",
    "3D design",
  ],
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.positioning}`,
    description: BRAND.oneLiner,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.positioning}`,
    description: BRAND.oneLiner,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Open the TCP/TLS connection to the API while the HTML is still parsing, so
  // the first data request (and product images) skip the handshake.
  try {
    preconnect(new URL(API_URL).origin);
  } catch {}
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body
        className="font-sans min-h-screen bg-background text-foreground flex flex-col antialiased"
      >
        <Providers>{children}</Providers>
        <FunnelLanding />
        {/* Anonymous page views (cookie-free) and real-user speed scores, both free on Vercel Hobby.
            The scripts are served by Vercel from this same origin and are deferred, so they never block first paint. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
