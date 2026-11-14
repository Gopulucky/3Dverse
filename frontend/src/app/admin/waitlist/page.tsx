"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ListChecks } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { INTERESTS, PRICE_CHOICES, waitlistCsv, type WaitlistSignupRow } from "@/lib/waitlist";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminStats, AdminAccessDenied, AdminTableSkeleton } from "@/components/admin/admin-page";

interface WaitlistSummary {
  total: number;
  by_interest: Record<string, number>;
  by_price: Record<string, number>;
  top_cities: { city: string; count: number }[];
  signups: WaitlistSignupRow[];
}

const interestLabel = (value: string) => INTERESTS.find(option => option.value === value)?.label ?? value;
const priceLabel = (value: string) => (value === "no_answer" ? "No answer" : PRICE_CHOICES.find(option => option.value === value)?.label ?? value);

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No answers yet.</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map(row => (
            <li key={row.label}>
              <div className="flex justify-between gap-3 text-sm"><span>{row.label}</span><span className="font-data tabular-nums">{row.count}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AdminWaitlistPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => api.get<WaitlistSummary>("/api/waitlist/admin"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  if (!isAuthenticated) return null;
  if (error) return <AdminAccessDenied detail={error instanceof ApiError ? error.detail : undefined} />;
  if (isLoading || !data) return <AdminShell><AdminTableSkeleton /></AdminShell>;

  const download = () => {
    const blob = new Blob([waitlistCsv(data.signups)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const topInterest = Object.entries(data.by_interest)[0];

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader icon={ListChecks} title="Launch waitlist"
          description="People who asked to hear when printed products launch, and what they told us they would buy." />

        <AdminStats stats={[
          { label: "Sign-ups", value: data.total },
          { label: "Most wanted", value: topInterest ? interestLabel(topInterest[0]) : "—" },
          { label: "Cities named", value: data.top_cities.length },
        ]} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Breakdown title="What they would buy" rows={Object.entries(data.by_interest).map(([value, count]) => ({ label: interestLabel(value), count }))} />
          <Breakdown title="Price for a name stand" rows={Object.entries(data.by_price).map(([value, count]) => ({ label: priceLabel(value), count }))} />
          <Breakdown title="Top cities" rows={data.top_cities.map(row => ({ label: row.city, count: row.count }))} />
        </div>

        <Card className="mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Sign-ups</h2>
            <Button type="button" variant="outline" onClick={download} disabled={!data.signups.length}>
              <Download size={16} aria-hidden="true" /> Download CSV
            </Button>
          </div>
          {data.signups.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No sign-ups yet. Share the home page to start collecting them.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-4 font-medium">Email</th><th className="py-2 pr-4 font-medium">Would buy</th><th className="py-2 pr-4 font-medium">Price</th><th className="py-2 pr-4 font-medium">City</th><th className="py-2 font-medium">Joined</th></tr>
                </thead>
                <tbody>
                  {data.signups.map(row => (
                    <tr key={row.email} className="border-t border-border">
                      <td className="py-2 pr-4">{row.email}</td>
                      <td className="py-2 pr-4">{interestLabel(row.interest)}</td>
                      <td className="py-2 pr-4 font-data">{row.price_choice ? priceLabel(row.price_choice) : "—"}</td>
                      <td className="py-2 pr-4">{row.city ?? "—"}</td>
                      <td className="py-2 font-data">{row.created_at ? new Date(row.created_at + "Z").toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
