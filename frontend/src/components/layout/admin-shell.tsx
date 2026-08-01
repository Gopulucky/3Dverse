"use client";

import { Navbar } from "@/components/layout/navbar";
import { Sidebar, type SidebarLink } from "@/components/layout/sidebar";
import {
  ShieldAlert,
  Users,
  Package,
  ShoppingCart,
  Undo2,
  ShieldCheck,
  Settings,
} from "lucide-react";

const adminLinks: SidebarLink[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: ShieldAlert },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/returns", label: "Returns", icon: Undo2 },
  { href: "/admin/trust-safety", label: "Trust & Safety", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * AdminShell — Admin Panel layout.
 * Sidebar + top nav. Admin is neutral by design (docs/brand/05-applications.md):
 * no audience accent — colour here means status (red/amber/green), not identity.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <Navbar />
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar links={adminLinks} portal="admin" />
        </div>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
