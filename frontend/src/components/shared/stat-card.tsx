"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card label (e.g. "Revenue this month") */
  label: string;
  /** The primary value to display (rendered in monospace) */
  value: string | number;
  /** Optional Lucide icon */
  icon?: LucideIcon;
  /** Icon background color class (e.g. "bg-primary/15") */
  iconBg?: string;
  /** Icon color class (e.g. "text-primary") */
  iconColor?: string;
  /** Optional trend indicator */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

/**
 * StatCard — shared KPI card used in Creator Dashboard and Partner Console Dashboard.
 * 
 * Renders a metric with monospace value (IBM Plex Mono), optional icon,
 * and optional trend indicator. Designed for dense dashboard layouts.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg = "bg-primary/15",
  iconColor = "text-primary",
  trend,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-sm border border-border bg-card p-4 flex flex-col justify-between transition-colors hover:border-primary/30 min-h-[110px]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between w-full">
        <p className="text-sm font-medium text-muted-foreground truncate mr-2">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-sm flex items-center justify-center shrink-0",
              iconBg
            )}
          >
            <Icon className={iconColor} size={16} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2 w-full">
        <h3 className="text-2xl font-bold text-foreground font-data truncate">
          {value}
        </h3>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold ml-auto",
              trend.direction === "up" && "text-moss",
              trend.direction === "down" && "text-destructive",
              trend.direction === "neutral" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" && "↑"}
            {trend.direction === "down" && "↓"}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
