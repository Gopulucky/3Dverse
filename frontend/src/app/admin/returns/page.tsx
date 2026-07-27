"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader,
  AdminStats,
  AdminToolbar,
  StatusPill,
  AdminAccessDenied,
  AdminTableSkeleton,
} from "@/components/admin/admin-page";

interface AdminReturn {
  id: number;
  order_id: number;
  order_item_id: number;
  customer_name: string | null;
  order_total: number | null;
  quantity: number;
  reason: string;
  description: string | null;
  status: string;
  requested_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  requested: "bg-warning-surface text-warning-ink",
  approved: "bg-primary-surface text-primary-ink",
  rejected: "bg-danger-surface text-danger-ink",
  received: "bg-success-surface text-success-ink",
  refunded: "bg-success-surface text-success-ink",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminReturnsPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: returns, isLoading, error } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: () => api.get<AdminReturn[]>("/api/admin/management/returns"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const decide = useMutation({
    mutationFn: ({ id, status, restock }: { id: number; status: string; restock?: boolean }) =>
      api.patch(`/api/admin/management/returns/${id}`, { status, restock: restock ?? true }),
    onSuccess: () => {
      toast.success("Return updated");
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update return"),
  });

  if (!isAuthenticated) return null;
  if (error) return <AdminAccessDenied detail={(error as any)?.detail} />;
  if (isLoading) {
    return (
      <AdminShell>
        <AdminTableSkeleton />
      </AdminShell>
    );
  }

  const all = returns || [];
  const visible = all.filter((r) => {
    const matchesFilter = filter === "all" ? true : r.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      String(r.order_id).includes(term) ||
      (r.customer_name || "").toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader
          icon={Undo2}
          title="Returns"
          description="Standard returns on Direct Seller stock -- approving and marking a return 'received' restocks it automatically."
        />

        <AdminStats
          stats={[
            { label: "Total Requests", value: all.length },
            {
              label: "Awaiting Review",
              value: all.filter((r) => r.status === "requested").length,
              accent: "text-ember",
            },
            {
              label: "Refunded",
              value: all.filter((r) => r.status === "refunded").length,
              accent: "text-success",
            },
            {
              label: "Rejected",
              value: all.filter((r) => r.status === "rejected").length,
              accent: "text-destructive",
            },
          ]}
        />

        <AdminToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by order # or customer name…"
          filters={FILTERS}
          activeFilter={filter}
          onFilter={setFilter}
          resultLabel={`${visible.length} of ${all.length}`}
        />

        <Card className="p-0 overflow-hidden bg-card border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-muted text-xs uppercase text-foreground">
                <tr>
                  <th className="px-4 py-4 font-semibold">Order</th>
                  <th className="px-4 py-4 font-semibold">Customer</th>
                  <th className="px-4 py-4 font-semibold">Reason</th>
                  <th className="px-4 py-4 font-semibold text-right">Qty</th>
                  <th className="px-4 py-4 font-semibold">Date</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4 font-data text-foreground">#{r.order_id}</td>
                    <td className="px-4 py-4">{r.customer_name || "—"}</td>
                    <td className="px-4 py-4">
                      <p className="capitalize">{r.reason.replace(/_/g, " ")}</p>
                      {r.description && <p className="text-xs opacity-70 max-w-xs truncate">{r.description}</p>}
                    </td>
                    <td className="px-4 py-4 font-data text-right">{r.quantity}</td>
                    <td className="px-4 py-4 font-data whitespace-nowrap">
                      {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill label={r.status} tone={STATUS_TONE[r.status] || "bg-muted text-muted-foreground"} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "requested" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, status: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decide.mutate({ id: r.id, status: "rejected" })}>
                              Reject
                            </Button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, status: "received", restock: true })}>
                            Mark Received
                          </Button>
                        )}
                        {r.status === "received" && (
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, status: "refunded" })}>
                            Mark Refunded
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No return requests match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
