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
  TrendingUp,
  Star,
  Wallet,
  Palette,
  Download,
  Users,
  Image,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Upload,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, string> = {
  paid: "bg-success-surface text-success-ink",
  queued: "bg-primary-surface text-primary-ink",
  printing: "bg-warning-surface text-warning-ink",
  shipped: "bg-success-surface text-success-ink",
  delivered: "bg-success-surface text-success-ink",
};

export default function DesignerOnlyDashboard() {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            Overview
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Royalty performance and design analytics.
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

      {/* ── Financial Summary Bar (Stripe-style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border border-border rounded-sm bg-card hover:bg-accent/5 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center justify-between">
            Total Royalties
            <span className="text-success flex items-center"><TrendingUp size={10} className="mr-0.5" /> +8.1%</span>
          </p>
          <p className="text-3xl font-bold font-data text-foreground">${data?.total_revenue ? (data.total_revenue * 0.15).toFixed(2) : "0.00"}</p>
        </div>
        <div className="p-4 border border-border rounded-sm bg-card hover:bg-accent/5 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center justify-between">
            Total Downloads
            <span className="text-success flex items-center"><TrendingUp size={10} className="mr-0.5" /> +11.3%</span>
          </p>
          <p className="text-3xl font-bold font-data text-foreground">{data?.total_sales || 0}</p>
        </div>
        <div className="p-4 border border-border rounded-sm bg-card hover:bg-accent/5 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Active Partners
          </p>
          <p className="text-3xl font-bold font-data text-muted-foreground">
            {data?.total_sales ? 3 : 0}
          </p>
        </div>
        <div className="p-4 border border-border rounded-sm bg-card hover:bg-accent/5 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Est. Payout
          </p>
          <p className="text-3xl font-bold font-data text-primary">${data?.estimated_payout ? (data.estimated_payout * 0.15).toFixed(2) : "0.00"}</p>
        </div>
      </div>

      {/* ── Main Chart Area ── */}
      <div className="border border-border rounded-sm bg-card mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" /> Royalties Over Time
          </h2>
        </div>
        <div className="px-4 py-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chart_data || []}>
                <defs>
                  <linearGradient id="colorRevenueFinDesigner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} className="font-data" />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} className="font-data" tickFormatter={(v) => `$${(Number(v)*0.15).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontFamily: "var(--font-sans)",
                  }}
                  formatter={(value: any) => [`$${(Number(value)*0.15).toFixed(2)}`, "Royalties"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenueFinDesigner)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Split: Design Library & Top Designs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="border border-border rounded-sm bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Palette size={14} className="text-primary" /> Design Library
            </h2>
            <Link href="/creator/products" className="text-xs text-primary font-semibold hover:underline">Manage</Link>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success" />
                <span className="text-sm text-foreground">Published Designs</span>
              </div>
              <span className="text-sm font-bold font-data">{data?.published_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-warning" />
                <span className="text-sm text-foreground">Drafts</span>
              </div>
              <span className="text-sm font-bold font-data">{data?.draft_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={14} className="text-moss" />
                <span className="text-sm text-foreground">Total Downloads</span>
              </div>
              <span className="text-sm font-bold font-data">{data?.total_sales ?? 0}</span>
            </div>
            <Button size="sm" variant="outline" className="w-full text-xs rounded-sm mt-2" onClick={() => router.push("/creator/products/new")}>
              <Upload size={12} className="mr-1" /> Upload New Design
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 border border-border rounded-sm bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Star size={14} className="text-ember" /> Top Performing Designs
            </h2>
          </div>
          {data?.top_products?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-4 py-2 font-semibold">Design Title</th>
                  <th className="px-4 py-2 font-semibold text-center">Downloads</th>
                  <th className="px-4 py-2 font-semibold text-right">Royalties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.top_products.map((tp: any) => (
                  <tr key={tp.product_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/creator/products/${tp.product_id}`} className="font-semibold text-xs text-foreground hover:text-primary transition-colors">
                        {tp.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-center font-data text-xs">{tp.units}</td>
                    <td className="px-4 py-2.5 text-right font-data font-bold text-xs">${(tp.revenue * 0.15).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground">No royalty data yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Partner Activity (Full Width Table) ── */}
      <div className="border border-border rounded-sm bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" /> Recent Partner Prints
          </h2>
          <Link href="/collaboration" className="text-xs text-primary font-semibold hover:underline">Manage Partners</Link>
        </div>
        <div className="overflow-x-auto">
          {data?.recent_orders?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Print ID</th>
                  <th className="px-4 py-2.5 font-semibold">Design</th>
                  <th className="px-4 py-2.5 font-semibold">Partner</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Royalty</th>
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
                        {o.product_title}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium text-muted-foreground">
                      Partner_{Math.floor(Math.random() * 100) + 1}
                    </td>
                    <td className="px-4 py-3 text-right font-data font-bold text-xs">
                      ${(o.amount * 0.15).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-xs text-muted-foreground mb-2">No recent partner prints.</p>
            </div>
          )}
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
