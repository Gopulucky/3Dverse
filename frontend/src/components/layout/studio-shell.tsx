"use client";

import { Navbar } from "@/components/layout/navbar";

/**
 * StudioShell — Amazon Seller Central style top navigation.
 * No left sidebar; Creator Studio navigation lives in the Navbar,
 * driven by the shared link lists in `@/lib/creator-nav`.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <Navbar />
      
      <div className="flex">
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}


