"use client";

import { Navbar } from "@/components/layout/navbar";

/**
 * AdminShell — dark-first layout for Admin Panel.
 * Graphite background, top navbar, no sidebar.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}
