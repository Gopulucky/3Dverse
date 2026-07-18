"use client";

import { useState, useEffect } from "react";
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
  Boxes,
  Printer,
  Layers,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { StatCard } from "@/components/shared/stat-card";
import { formatDate } from "@/lib/utils";

const quickActions = [
  { href: "/creator/products/new", label: "Upload Product", icon: Upload },
  { href: "/creator/products", label: "My Products", icon: Boxes },
  { href: "/creator/printers", label: "My Printers", icon: Printer },
  { href: "/creator/materials", label: "Materials", icon: Layers },
];

const statusVariant: Record<string, string> = {
  paid: "bg-success/15 text-success",
  queued: "bg-primary/15 text-primary",
  printing: "bg-nozzle-orange/15 text-nozzle-orange",
  shipped: "bg-calibration-cyan/15 text-calibration-cyan",
  delivered: "bg-success/15 text-success",
};

function trendOf(pct: number | null | undefined) {
  if (pct == null) return undefined;
  return {
    value: `${Math.abs(pct)}%`,
    direction: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("neutral" as const),
  };
}

export default function CreatorDashboard() {
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
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <TrendingUp className="text-primary" />
            Creator Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {data?.published_count ?? 0} live product{data?.published_count === 1 ? "" : "s"}
            {data?.draft_count > 0 && ` · ${data.draft_count} draft${data.draft_count === 1 ? "" : "s"}`}
            {" · "}you keep {Math.round((data?.payout_share ?? 0.85) * 100)}% of every sale
          </p>
        </div>
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <a.icon size={18} className="text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{a.label}</span>
            <ArrowRight
              size={14}
              className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Revenue"
          value={`$${data?.total_revenue?.toFixed(2) || "0.00"}`}
          icon={DollarSign}
          iconBg="bg-success/15"
          iconColor="text-success"
          trend={trendOf(data?.revenue_change_pct)}
        />
        <StatCard
          label="Units Sold"
          value={data?.total_sales || 0}
          icon={Package}
          iconBg="bg-primary/15"
          iconColor="text-primary"
          trend={trendOf(data?.sales_change_pct)}
        />
        <StatCard
          label="Est. Payout"
          value={`$${data?.estimated_payout?.toFixed(2) || "0.00"}`}
          icon={Wallet}
          iconBg="bg-calibration-cyan/15"
          iconColor="text-calibration-cyan"
        />
        <StatCard
          label="Avg Rating"
          value={data?.avg_rating != null ? data.avg_rating.toFixed(1) : "—"}
          icon={Star}
          iconBg="bg-nozzle-orange/15"
          iconColor="text-nozzle-orange"
          trend={
            data?.review_count
              ? { value: `${data.review_count} reviews`, direction: "neutral" }
              : undefined
          }
        />
      </div>

      {/* Revenue Area Chart */}
      <Card className="p-6 mb-8 border-border bg-card">
        <h3 className="text-xl font-bold mb-6 font-display text-foreground">Revenue Over Time</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart_data || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
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
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top products + recent orders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border bg-card">
          <h3 className="text-lg font-bold mb-4 font-display text-foreground">Top Products</h3>
          {data?.top_products?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3 font-semibold">Product</th>
                    <th className="pb-2 pr-3 font-semibold text-right">Units</th>
                    <th className="pb-2 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_products.map((tp: any) => (
                    <tr key={tp.product_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/creator/products/${tp.product_id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {tp.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-data">{tp.units}</td>
                      <td className="py-2.5 text-right font-data font-semibold">
                        ${tp.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm mb-3">
                No sales in this period yet.
              </p>
              <Link
                href="/creator/products/new"
                className="text-primary text-sm font-semibold hover:underline"
              >
                Upload your first product →
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-6 border-border bg-card">
          <h3 className="text-lg font-bold mb-4 font-display text-foreground">Recent Orders</h3>
          {data?.recent_orders?.length ? (
            <div className="space-y-3">
              {data.recent_orders.map((o: any, i: number) => (
                <div
                  key={`${o.order_id}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {o.product_title}
                      {o.quantity > 1 && (
                        <span className="text-muted-foreground font-normal"> ×{o.quantity}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-data">
                      Order #{o.order_id} · {formatDate(o.created_at)}
                    </p>
                  </div>
                  <Badge
                    className={`border-transparent capitalize ${statusVariant[o.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {o.status}
                  </Badge>
                  <span className="font-data font-semibold text-sm">
                    ${o.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">
              Orders for your products will appear here.
            </p>
          )}
        </Card>
      </div>
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
