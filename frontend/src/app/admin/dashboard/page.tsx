"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Package,
  Users,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { AreaTrend, BarTrend } from "@/components/shared/lazy-charts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { AdminShell } from "@/components/layout/admin-shell";
import { StatCard } from "@/components/shared/stat-card";

export default function AdminDashboard() {
  const router = useRouter();
  const { ready: isAuthenticated, user } = useRequireAuth();
  const [days, setDays] = useState(30);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => api.get<any>(`/api/analytics/admin`, { days: days.toString() }),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });


  if (!isAuthenticated) return null;

  if (error) {
    return (
      <AdminShell>
        <div className="min-h-screen flex items-center justify-center flex-col px-6">
          <ShieldAlert className="text-destructive w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold mb-2 font-display">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-md text-sm">
            {(error as any)?.detail ||
              "You must be logged in as an Admin to view this dashboard."}
          </p>
        </div>
      </AdminShell>
    );
  }

  const content = (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <ShieldAlert className="text-foreground" />
            Admin Platform Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Track global platform health, user base, and total revenue.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-card border border-input text-foreground text-sm rounded-md focus:ring-2 focus:ring-ring block p-2.5 shadow-sm font-semibold focus-visible:outline-none"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Platform Revenue"
          value={`$${data?.platform_revenue?.toFixed(2) || "0.00"}`}
          icon={DollarSign}
          trend={{ value: "+18.2%", direction: "up" }}
        />
        <StatCard
          label="Order Volume"
          value={data?.order_volume || 0}
          icon={Package}
          trend={{ value: "+5.4%", direction: "up" }}
        />
        <StatCard
          label="Active Users"
          value={data?.total_users || 0}
          icon={Users}
          trend={{ value: "+21.1%", direction: "up" }}
        />
        <StatCard
          label="Physical / Digital"
          value={`${data?.physical_orders || 0} / ${data?.digital_orders || 0}`}
          icon={Printer}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Revenue Area Chart */}
        <Card className="p-6 border-border bg-card">
          <h3 className="text-xl font-bold mb-6 font-display text-foreground">Platform Revenue</h3>
          <div className="h-80 w-full">
            <AreaTrend
              data={data?.chart_data || []}
              gradientId="colorAdminRev"
              color="var(--color-slate-9)"
              fillOpacity={0.2}
              fontSize={12}
              tooltipRadius="12px"
              tickFormatter={(v) => `$${v}`}
              tooltipFormatter={(v) => [`$${v.toFixed(2)}`, "Revenue"]}
            />
          </div>
        </Card>

        {/* Order Volume Bar Chart */}
        <Card className="p-6 border-border bg-card">
          <h3 className="text-xl font-bold mb-6 font-display text-foreground">Order Volume</h3>
          <div className="h-80 w-full">
            <BarTrend data={data?.chart_data || []} color="var(--color-slate-9)" />
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <AdminShell>
      {isLoading ? (
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      ) : (
        content
      )}
    </AdminShell>
  );
}
