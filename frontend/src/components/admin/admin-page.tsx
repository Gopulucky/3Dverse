"use client";

import { Search, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** Page title block shared by every admin management page. */
export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Icon className="text-primary" />
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      </div>
      {actions}
    </div>
  );
}

/** Compact KPI row above an admin table. */
export function AdminStats({
  stats,
}: {
  stats: { label: string; value: string | number; accent?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 border-border">
          <p className="text-xs text-muted-foreground font-medium truncate">{s.label}</p>
          <p className={cn("text-2xl font-bold font-data mt-1", s.accent || "text-foreground")}>
            {s.value}
          </p>
        </Card>
      ))}
    </div>
  );
}

/** Search box plus a row of filter pills. */
export function AdminToolbar({
  search,
  onSearch,
  placeholder,
  filters,
  activeFilter,
  onFilter,
  resultLabel,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  filters: { value: string; label: string }[];
  activeFilter: string;
  onFilter: (value: string) => void;
  resultLabel: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-0">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
              activeFilter === f.value
                ? "bg-primary/15 border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-data">
        {resultLabel}
      </span>
    </div>
  );
}

/** Colored status pill used across admin tables. */
export function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={cn(
        "px-2 py-1 rounded text-xs font-semibold capitalize whitespace-nowrap",
        tone
      )}
    >
      {label}
    </span>
  );
}

/** Full-page access-denied state for non-admins / failed admin calls. */
export function AdminAccessDenied({ detail }: { detail?: string }) {
  return (
    <AdminShell>
      <div className="min-h-screen flex items-center justify-center flex-col px-6">
        <ShieldAlert className="text-destructive w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold mb-2 font-display">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md text-sm">
          {detail || "You must be logged in as an Admin to view this page."}
        </p>
      </div>
    </AdminShell>
  );
}

/** Loading skeleton matching the admin table layout. */
export function AdminTableSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-20 space-y-6">
      <Skeleton className="h-10 w-64 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
