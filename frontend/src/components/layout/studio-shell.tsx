"use client";

import { Navbar } from "@/components/layout/navbar";
import { Sidebar, type SidebarLink } from "@/components/layout/sidebar";
import {
  LayoutDashboard,
  Package,
  Palette,
  Printer,
  Beaker,
  ClipboardList,
  Image,
  Settings,
} from "lucide-react";

const studioLinks: SidebarLink[] = [
  { href: "/creator/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/creator/products", label: "Design Library", icon: Package },
  { href: "/creator/products/new", label: "Upload", icon: Palette },
  { href: "/creator/printers", label: "My Printers", icon: Printer },
  { href: "/creator/materials", label: "Materials & Finishes", icon: Beaker },
  { href: "/creator/orders", label: "Orders", icon: ClipboardList },
  { href: "/creator/portfolio", label: "Portfolio", icon: Image },
  { href: "/creator/settings", label: "Settings", icon: Settings },
];

/**
 * StudioShell — dark-first layout for Creator Studio.
 * Graphite background, sidebar + top nav, no footer.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar links={studioLinks} portal="studio" />
        </div>
        <main className="flex-1 md:ml-[240px] min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

