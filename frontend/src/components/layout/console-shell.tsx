"use client";

import { Navbar } from "@/components/layout/navbar";
import { Sidebar, type SidebarLink } from "@/components/layout/sidebar";
import {
  Printer,
} from "lucide-react";

const consoleLinks: SidebarLink[] = [
  { href: "/partner", label: "Job Queue", icon: Printer },
];

/**
 * ConsoleShell — dark-first layout for Print Partner Console.
 * Graphite background, Calibration Cyan accent, sidebar + top nav, no footer.
 * Uses data-portal="partner" to switch primary color to Calibration Cyan.
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-portal="partner" className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar links={consoleLinks} portal="console" />
        </div>
        <main className="flex-1 md:ml-[240px] min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
