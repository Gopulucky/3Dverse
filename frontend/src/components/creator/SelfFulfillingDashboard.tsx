"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  Package,
  TrendingUp,
  Star,
  Wallet,
  Upload,
  ClipboardList,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  BarChart3,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { formatDate } from "@/lib/utils";
import { AIInsightsPanel } from "@/components/shared/ai-insights-panel";
import { FunnelChart } from "@/components/shared/funnel-chart";

const statusVariant: Record<string, string> = {
  paid: "bg-success-surface text-success-ink",
  queued: "bg-primary-surface text-primary-ink",
  printing: "bg-warning-surface text-warning-ink",
  shipped: "bg-success-surface text-success-ink",
  delivered: "bg-success-surface text-success-ink",
};

export default function SelfFulfillingDashboard() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-analytics", days],
    queryFn: () => api.get<any>(`/api/analytics/creator`, { days: days.toString() }),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const content = (
    <div className="w-full px-6 pt-6 pb-12">
      {/* ── Top Bar: Title + Date Range ── */}
      <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            Good Morning, Creator 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your studio today.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-card border border-input text-foreground text-xs rounded-sm focus:ring-2 focus:ring-ring block px-3 py-2 font-semibold focus-visible:outline-none"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {/* ── KPI Cards (Revenue, Orders, Models, Views) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-5 border border-border rounded-2xl bg-card hover-lift transition-all group">
          <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            Revenue
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <DollarSign size={16} className="text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-foreground">
            ${data?.total_revenue?.toFixed(2) || "0.00"}
          </p>
          <p className="text-xs text-success flex items-center mt-2 font-medium">
            <TrendingUp size={12} className="mr-1" /> +14.2% from last month
          </p>
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card hover-lift transition-all group">
          <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            Orders
            <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
              <ShoppingCart size={16} className="text-success" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-foreground">
            {data?.total_sales || 0}
          </p>
          <p className="text-xs text-muted-foreground flex items-center mt-2 font-medium">
            <span className="text-success mr-1">+5</span> new this week
          </p>
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card hover-lift transition-all group">
          <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            Models
            <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
              <Package size={16} className="text-warning" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-foreground">
            {data?.published_count || 0}
          </p>
          <p className="text-xs text-muted-foreground flex items-center mt-2 font-medium">
            <span className="text-warning mr-1">{data?.draft_count || 0}</span> in drafts
          </p>
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card hover-lift transition-all group">
          <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center justify-between">
            Views
            <div className="p-2 bg-ember/10 rounded-lg group-hover:bg-ember/20 transition-colors">
              <Eye size={16} className="text-ember" />
            </div>
          </div>
          <p className="text-3xl font-bold font-display text-foreground">
            9,210
          </p>
          <p className="text-xs text-success flex items-center mt-2 font-medium">
            <TrendingUp size={12} className="mr-1" /> +22.4% traffic
          </p>
        </div>
      </div>
      {/* ── Main: Revenue Chart + Funnel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 border border-border rounded-2xl bg-card hover-lift transition-all flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <BarChart3 size={14} className="text-primary" /> Net Revenue Over Time
            </h2>
          </div>
          <div className="px-5 py-6 flex-1">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.chart_data || []}>
                  <defs>
                    <linearGradient id="colorRevenueFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} className="font-data" />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} className="font-data" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-foreground)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      border: "1px solid var(--color-border)",
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Net Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueFin)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <FunnelChart />
        </div>
      </div>

      {/* ── Split: Recent Transactions & AI Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 border border-border rounded-2xl bg-card hover-lift transition-all flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ClipboardList size={14} className="text-muted-foreground" /> Recent Transactions
            </h2>
            <Link href="/creator/orders" className="text-xs text-primary font-semibold hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto flex-1">
          {data?.recent_orders?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Order ID</th>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.recent_orders.map((o: any, i: number) => (
                  <tr key={`${o.order_id}-${i}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-data whitespace-nowrap">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-data font-medium text-foreground">
                      #{o.order_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-foreground truncate block max-w-xs">
                        {o.product_title} {o.quantity > 1 && `×${o.quantity}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border-transparent capitalize text-[9px] px-1.5 py-0.5 rounded-sm ${statusVariant[o.status] || "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-data font-bold text-xs">
                      ${o.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-xs text-muted-foreground mb-2">No recent transactions.</p>
            </div>
          )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <AIInsightsPanel />
        </div>
      </div>
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="w-full px-6 pt-6 pb-12 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
