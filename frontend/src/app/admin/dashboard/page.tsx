"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  DollarSign,
  Package,
  Users,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
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
          <ShieldAlert className="text-danger-red w-16 h-16 mb-4" />
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
            <ShieldAlert className="text-primary" />
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
          iconBg="bg-success/15"
          iconColor="text-success"
          trend={{ value: "+18.2%", direction: "up" }}
        />
        <StatCard
          label="Order Volume"
          value={data?.order_volume || 0}
          icon={Package}
          iconBg="bg-primary/15"
          iconColor="text-primary"
          trend={{ value: "+5.4%", direction: "up" }}
        />
        <StatCard
          label="Active Users"
          value={data?.total_users || 0}
          icon={Users}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
          trend={{ value: "+21.1%", direction: "up" }}
        />
        <StatCard
          label="Physical / Digital"
          value={`${data?.physical_orders || 0} / ${data?.digital_orders || 0}`}
          icon={Printer}
          iconBg="bg-nozzle-orange/15"
          iconColor="text-nozzle-orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Revenue Area Chart */}
        <Card className="p-6 border-border bg-card">
          <h3 className="text-xl font-bold mb-6 font-display text-foreground">Platform Revenue</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chart_data || []}>
                <defs>
                  <linearGradient id="colorAdminRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  className="font-data"
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  className="font-data"
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                    borderRadius: "12px",
                    fontFamily: "var(--font-sans)",
                  }}
                  formatter={(value: any) => [
                    `$${Number(value).toFixed(2)}`,
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAdminRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Order Volume Bar Chart */}
        <Card className="p-6 border-border bg-card">
          <h3 className="text-xl font-bold mb-6 font-display text-foreground">Order Volume</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chart_data || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  className="font-data"
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  className="font-data"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                    borderRadius: "12px",
                    fontFamily: "var(--font-sans)",
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
