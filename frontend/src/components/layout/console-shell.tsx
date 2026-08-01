"use client";

import { Navbar } from "@/components/layout/navbar";
import { Sidebar, type SidebarLink } from "@/components/layout/sidebar";
import {
  Printer,
  Settings,
} from "lucide-react";

const consoleLinks: SidebarLink[] = [
  { href: "/partner", label: "Job Queue", icon: Printer },
  { href: "/partner/settings", label: "Settings", icon: Settings },
];

/**
 * ConsoleShell — Print Partner Console layout.
 * Sidebar + top nav, no footer. Accent is Moss (Calibration Green) per
 * docs/brand/05-applications.md — job-queue status, capacity indicators and
 * the active nav item carry it; the shell itself stays on the shared
 * light/dark token system, no forced-dark background.
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <Navbar />
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar links={consoleLinks} portal="console" />
        </div>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
