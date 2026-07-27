"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, PackageX } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdminPageHeader,
  AdminStats,
  StatusPill,
  AdminAccessDenied,
  AdminTableSkeleton,
} from "@/components/admin/admin-page";

interface DefectReport {
  id: number;
  order_id: number;
  customer_id: number | null;
  order_total: number | null;
  description: string | null;
  within_window: boolean;
  reprint_status: string;
  reported_at: string | null;
}

interface RiskFlag {
  type: string;
  reason: string;
  product_id?: number;
  product_title?: string;
  print_partner_id?: number;
  print_partner_name?: string;
  creator_id?: number;
  defect_count?: number;
  reship_defect_rate?: number;
  rejected_count?: number;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning-surface text-warning-ink",
  approved: "bg-primary-surface text-primary-ink",
  reprinted: "bg-success-surface text-success-ink",
  denied: "bg-danger-surface text-danger-ink",
};

const FLAG_LABEL: Record<string, string> = {
  product_defect_rate: "Product defect rate",
  partner_reship_rate: "Partner reship rate",
  creator_ticket_disputes: "Creator ticket disputes",
  partner_ticket_disputes: "Partner ticket disputes",
};

export default function TrustSafetyPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"defects" | "flags">("defects");

  const { data: reports, isLoading: loadingReports, error: reportsError } = useQuery({
    queryKey: ["admin-defect-reports"],
    queryFn: () => api.get<DefectReport[]>("/api/admin/management/defect-reports"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const { data: flags, isLoading: loadingFlags } = useQuery({
    queryKey: ["admin-trust-safety-flags"],
    queryFn: () => api.get<RiskFlag[]>("/api/admin/management/trust-safety/flags"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const decide = useMutation({
    mutationFn: ({ id, reprint_status }: { id: number; reprint_status: string }) =>
      api.patch(`/api/admin/management/defect-reports/${id}`, { reprint_status }),
    onSuccess: () => {
      toast.success("Defect report updated");
      queryClient.invalidateQueries({ queryKey: ["admin-defect-reports"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update"),
  });

  if (!isAuthenticated) return null;
  if (reportsError) return <AdminAccessDenied detail={(reportsError as any)?.detail} />;
  if (loadingReports || loadingFlags) {
    return (
      <AdminShell>
        <AdminTableSkeleton />
      </AdminShell>
    );
  }

  const all = reports || [];
  const allFlags = flags || [];
  const pending = all.filter((r) => r.reprint_status === "pending");

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader
          icon={ShieldCheck}
          title="Trust & Safety"
          description="Defect/reprint approvals for made-to-order items, and rule-based risk flags -- no AI scoring yet, revisited once there's enough real dispute data to train on."
        />

        <AdminStats
          stats={[
            { label: "Defect Reports", value: all.length },
            {
              label: "Awaiting Review",
              value: pending.length,
              accent: "text-ember",
            },
            {
              label: "Active Risk Flags",
              value: allFlags.length,
              accent: allFlags.length > 0 ? "text-destructive" : "text-success",
            },
          ]}
        />

        <div className="mb-6 border-b border-border flex gap-4">
          {(["defects", "flags"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-semibold transition-colors relative ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "defects" ? "Defect Reports" : "Risk Flags"}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
            </button>
          ))}
        </div>

        {tab === "defects" ? (
          <Card className="p-0 overflow-hidden bg-card border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-muted text-xs uppercase text-foreground">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Order</th>
                    <th className="px-4 py-4 font-semibold">Description</th>
                    <th className="px-4 py-4 font-semibold">Within 48h</th>
                    <th className="px-4 py-4 font-semibold">Reported</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-4 font-data text-foreground">#{r.order_id}</td>
                      <td className="px-4 py-4 max-w-sm truncate">{r.description || "—"}</td>
                      <td className="px-4 py-4">
                        {r.within_window ? (
                          <Badge variant="success">Yes</Badge>
                        ) : (
                          <Badge variant="destructive">No</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 font-data whitespace-nowrap">
                        {r.reported_at ? new Date(r.reported_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill label={r.reprint_status} tone={STATUS_TONE[r.reprint_status] || "bg-muted text-muted-foreground"} />
                      </td>
                      <td className="px-4 py-4">
                        {r.reprint_status === "pending" && (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, reprint_status: "approved" })}>
                              Approve Reprint
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decide.mutate({ id: r.id, reprint_status: "denied" })}>
                              Deny
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {all.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No defect reports.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {allFlags.length === 0 ? (
              <Card className="p-12 text-center border-border">
                <ShieldCheck size={48} className="mx-auto text-success mb-4" />
                <p className="text-muted-foreground">No risk signals at the moment.</p>
              </Card>
            ) : (
              allFlags.map((f, i) => (
                <Card key={i} className="p-4 border-border flex items-start gap-3">
                  {f.type === "product_defect_rate" ? (
                    <PackageX className="text-destructive shrink-0 mt-0.5" size={18} />
                  ) : (
                    <AlertTriangle className="text-ember shrink-0 mt-0.5" size={18} />
                  )}
                  <div>
                    <p className="font-semibold text-sm">
                      {FLAG_LABEL[f.type] || f.type}
                      {f.product_title && ` — ${f.product_title}`}
                      {f.print_partner_name && ` — ${f.print_partner_name}`}
                      {f.creator_id && ` — creator #${f.creator_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{f.reason}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
