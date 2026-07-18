import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Display — headlines, hero numbers, section titles
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Body — paragraphs, UI labels, buttons, nav
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Utility / data — prices, dimensions, order IDs, job IDs
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "3DVerse — Premium 3D Marketplace",
    template: "%s | 3DVerse",
  },
  description:
    "The premium marketplace for 3D-printed goods. Discover, customize, and order stunning 3D designs from talented creators worldwide.",
  keywords: [
    "3D printing",
    "marketplace",
    "3D models",
    "STL files",
    "print on demand",
    "3D design",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans min-h-screen bg-background text-foreground flex flex-col antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
