"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Target } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import {
  BOUGHT_WHERE, OCCASIONS, PERSONALISE, PRINTERS, ROLES, SPEND_BANDS, USES, audienceCsv, labelOf,
  type AudienceRow, type Option,
} from "@/lib/audience";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminStats, AdminAccessDenied, AdminTableSkeleton } from "@/components/admin/admin-page";

interface AudienceSummary {
  total: number;
  with_email: number;
  chat_ok: number;
  by_role: Record<string, number>;
  by_use: Record<string, number>;
  by_occasion: Record<string, number>;
  by_printer: Record<string, number>;
  by_personalise: Record<string, number>;
  by_bought_where: Record<string, number>;
  by_spend: Record<string, number>;
  top_cities: { city: string; count: number }[];
  use_by_role: Record<string, Record<string, number>>;
  missing: { text: string; role: string | null; city: string | null; created_at: string | null }[];
  responses: AudienceRow[];
  suggestions: string[];
}

function Breakdown({ title, counts, options }: { title: string; counts: Record<string, number>; options: Option[] }) {
  const rows = Object.entries(counts).map(([value, count]) => ({ label: labelOf(options, value), count }));
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No answers yet.</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
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

export default function AdminAudiencePage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audience"],
    queryFn: () => api.get<AudienceSummary>("/api/audience/admin"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  if (!isAuthenticated) return null;
  if (error) return <AdminAccessDenied detail={error instanceof ApiError ? error.detail : undefined} />;
  if (isLoading || !data) return <AdminShell><AdminTableSkeleton /></AdminShell>;

  const download = () => {
    const blob = new Blob([audienceCsv(data.responses)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audience-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const roles = Object.keys(data.use_by_role);

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20 space-y-6">
        <AdminPageHeader icon={Target} title="Audience"
          description="Who your visitors are, where they are and what they want, from the popup questions. Each question maps to a decision." />

        <AdminStats stats={[
          { label: "Responses", value: data.total },
          { label: "Left an email", value: data.with_email },
          { label: "Open to a chat", value: data.chat_ok },
          { label: "Cities named", value: data.top_cities.length },
        ]} />

        <Card className="p-5" aria-labelledby="audience-suggestions">
          <h2 id="audience-suggestions" className="font-display text-lg font-semibold">What this suggests</h2>
          {data.suggestions.length === 0
            ? <p className="mt-3 text-sm text-muted-foreground" role="status">Suggestions appear once there are 30 responses. Until then the numbers are too small to act on: keep sharing your tagged links ({data.total} so far).</p>
            : <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{data.suggestions.map((text) => <li key={text}>{text}</li>)}</ul>}
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Breakdown title="Who they are" counts={data.by_role} options={ROLES} />
          <Breakdown title="What they want from 3DVerse" counts={data.by_use} options={USES} />
          <Breakdown title="Gift occasions" counts={data.by_occasion} options={OCCASIONS} />
          <Breakdown title="Own a 3D printer?" counts={data.by_printer} options={PRINTERS} />
          <Breakdown title="Want it personalised?" counts={data.by_personalise} options={PERSONALISE} />
          <Breakdown title="Where they bought last time" counts={data.by_bought_where} options={BOUGHT_WHERE} />
          <Breakdown title="What that cost" counts={data.by_spend} options={SPEND_BANDS} />
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold">Where they are</h2>
            {data.top_cities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No cities yet.</p> : (
              <ul className="mt-4 space-y-2 text-sm">
                {data.top_cities.map((row) => <li key={row.city} className="flex justify-between gap-3"><span>{row.city}</span><span className="font-data tabular-nums">{row.count}</span></li>)}
              </ul>
            )}
          </Card>
        </div>

        <Card className="overflow-x-auto">
          <h2 className="px-4 pt-4 font-display text-lg font-semibold">What each group wants</h2>
          <table className="mt-2 w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Group</th>
                {USES.map((use) => <th key={use.value} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{use.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 && <tr><td className="px-3 py-3 text-sm text-muted-foreground" colSpan={USES.length + 1}>No answers yet.</td></tr>}
              {roles.map((role) => (
                <tr key={role} className="border-t border-border">
                  <td className="px-3 py-2 text-sm font-medium">{labelOf(ROLES, role)}</td>
                  {USES.map((use) => <td key={use.value} className="px-3 py-2 text-sm font-data tabular-nums">{data.use_by_role[role][use.value] ?? 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold">What’s missing today, in their words</h2>
          {data.missing.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No written answers yet.</p> : (
            <ul className="mt-3 space-y-3 text-sm">
              {data.missing.map((item, index) => (
                <li key={index}>
                  <p>{item.text}</p>
                  <p className="text-xs text-muted-foreground">{[item.role && labelOf(ROLES, item.role), item.city].filter(Boolean).join(" · ") || "Anonymous"}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="outline" onClick={download} className="min-h-11"><Download size={16} aria-hidden="true" /> Download CSV</Button>
      </div>
    </AdminShell>
  );
}
