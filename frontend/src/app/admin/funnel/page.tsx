"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { STEP_LABELS, shareOfVisitors, type FunnelReport } from "@/lib/funnel";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { AdminPageHeader, AdminStats, AdminAccessDenied, AdminTableSkeleton } from "@/components/admin/admin-page";

const SOURCE_COLUMNS = ["landing", "product_view", "add_to_cart", "buy_now", "checkout_started", "paid"] as const;
const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 py-2 text-sm font-data tabular-nums";

export default function AdminFunnelPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: () => api.get<FunnelReport>("/api/events/admin/funnel"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  if (!isAuthenticated) return null;
  if (error) return <AdminAccessDenied detail={error instanceof ApiError ? error.detail : undefined} />;
  if (isLoading || !data) return <AdminShell><AdminTableSkeleton /></AdminShell>;

  const step = (name: string) => data.steps.find(item => item.event === name) ?? { event: name, count: 0, visitors: 0 };
  const landed = step("landing").visitors;
  const empty = data.steps.every(item => item.count === 0);

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20 space-y-6">
        <AdminPageHeader icon={Filter} title="Visitor funnel"
          description="What anonymous visitors did, from first visit to payment, and which link brought them. Counts of visitors are distinct anonymous ids." />

        <AdminStats stats={[
          { label: "Visitors", value: landed },
          { label: "Viewed a product", value: step("product_view").visitors },
          { label: "Started checkout", value: step("checkout_started").visitors },
          { label: "Paid orders", value: step("paid").count },
        ]} />

        {empty && <Card className="p-5 text-sm" role="status">
          Nothing recorded yet. Share links with a tag to see which channel works, for example
          <span className="font-data"> /?src=instagram_bio</span>, <span className="font-data">/?src=whatsapp_group</span> or <span className="font-data">/?src=college_poster</span>.
        </Card>}

        <Card className="overflow-x-auto">
          <h2 className="px-3 pt-4 font-display text-lg font-semibold">Steps</h2>
          <table className="mt-2 w-full">
            <thead><tr><th className={th}>Step</th><th className={th}>Times</th><th className={th}>Visitors</th><th className={th}>% of visitors</th></tr></thead>
            <tbody>
              {data.steps.map(item => (
                <tr key={item.event} className="border-t border-border">
                  <td className="px-3 py-2 text-sm">{STEP_LABELS[item.event] ?? item.event}</td>
                  <td className={td}>{item.count}</td>
                  <td className={td}>{item.visitors}</td>
                  <td className={td}>{shareOfVisitors(item.visitors, landed) ?? "—"}{shareOfVisitors(item.visitors, landed) == null ? "" : "%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-3 text-xs text-muted-foreground">Buy Now skips the cart, so &ldquo;Added to cart&rdquo; and &ldquo;Pressed Buy Now&rdquo; are separate routes to checkout.</p>
        </Card>

        <Card className="overflow-x-auto">
          <h2 className="px-3 pt-4 font-display text-lg font-semibold">By link source (visitors reaching each step)</h2>
          <table className="mt-2 w-full">
            <thead><tr><th className={th}>Source</th><th className={th}>Visitors</th>{SOURCE_COLUMNS.map(name => <th key={name} className={th}>{STEP_LABELS[name]}</th>)}</tr></thead>
            <tbody>
              {data.by_source.length === 0 && <tr><td className="px-3 py-3 text-sm text-muted-foreground" colSpan={SOURCE_COLUMNS.length + 2}>No visits yet.</td></tr>}
              {data.by_source.map(item => (
                <tr key={item.source} className="border-t border-border">
                  <td className="px-3 py-2 text-sm font-medium">{item.source}</td>
                  <td className={td}>{item.visitors}</td>
                  {SOURCE_COLUMNS.map(name => <td key={name} className={td}>{item.steps[name] ?? 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto">
          <h2 className="px-3 pt-4 font-display text-lg font-semibold">By product</h2>
          <table className="mt-2 w-full">
            <thead><tr><th className={th}>Product</th><th className={th}>Views</th><th className={th}>Added to cart</th><th className={th}>Buy Now</th></tr></thead>
            <tbody>
              {data.by_product.length === 0 && <tr><td className="px-3 py-3 text-sm text-muted-foreground" colSpan={4}>No product views yet.</td></tr>}
              {data.by_product.map(item => (
                <tr key={item.product_id} className="border-t border-border">
                  <td className="px-3 py-2 text-sm">{item.title}</td>
                  <td className={td}>{item.views}</td><td className={td}>{item.carts}</td><td className={td}>{item.buys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AdminShell>
  );
}
