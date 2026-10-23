"use client";

import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import dynamic from "next/dynamic";

// Dev-only widget: when disabled, the build-time constant makes this branch dead
// code, so the overlay and the bug detector never ship to production visitors.
const BUG_DETECTOR_ON =
  process.env.NEXT_PUBLIC_BUG_DETECTOR === "1" ||
  (process.env.NEXT_PUBLIC_BUG_DETECTOR !== "0" && process.env.NODE_ENV === "development");
const BugOverlay = BUG_DETECTOR_ON
  ? dynamic(() => import("@/components/shared/bug-overlay").then((m) => m.BugOverlay), { ssr: false })
  : () => null;

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        <BugOverlay />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              borderRadius: "12px",
              fontFamily: "var(--font-sans)",
            },
          }}
          richColors
          closeButton
        />
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
