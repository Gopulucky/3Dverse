"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeft, type LucideIcon } from "lucide-react";

export interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  links: SidebarLink[];
  portal: "studio" | "console" | "admin";
}

/**
 * Collapsible sidebar for Creator Studio, Partner Console and Admin.
 * 72px collapsed / 240px expanded per spec.
 *
 * Active-state colour follows the audience-accent rule in
 * docs/brand/05-applications.md: studio→ember, console→moss, admin→neutral
 * (admin carries no identity accent — colour there means status only).
 */
const PORTAL_ACTIVE_CLASS: Record<SidebarProps["portal"], string> = {
  studio: "bg-ember-surface text-ember-ink",
  console: "bg-moss-surface text-moss-ink",
  admin: "bg-secondary text-foreground",
};

export function Sidebar({ links, portal }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const activeClass = PORTAL_ACTIVE_CLASS[portal];

  return (
    <aside
      className={cn(
        "sticky top-16 h-[calc(100vh-4rem)] z-40 flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href + "/"));

          const linkContent = (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                collapsed ? "justify-center px-3 py-3" : "px-3 py-2.5",
                isActive
                  ? activeClass
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <link.icon size={20} className="shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={link.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {link.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeft size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

/**
 * Wrapper that accounts for sidebar width in the main content area.
 */
export function SidebarLayout({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "transition-all duration-200",
        collapsed ? "ml-[72px]" : "ml-[240px]"
      )}
    >
      {children}
    </div>
  );
}
