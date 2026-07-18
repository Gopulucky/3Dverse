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
        "rounded-xl border border-border bg-card p-5 flex items-center gap-4 transition-colors hover:border-primary/30",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",
            iconBg
          )}
        >
          <Icon className={iconColor} size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground mb-1 truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-foreground font-data truncate">
            {value}
          </h3>
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend.direction === "up" && "text-calibration-cyan",
                trend.direction === "down" && "text-danger-red",
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
    </div>
  );
}
