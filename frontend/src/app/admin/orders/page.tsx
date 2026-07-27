"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import {
  AdminPageHeader,
  AdminStats,
  AdminToolbar,
  StatusPill,
  AdminAccessDenied,
  AdminTableSkeleton,
} from "@/components/admin/admin-page";

interface AdminOrder {
  id: number;
  customer_id: number;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  mode: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  item_count: number;
  created_at: string | null;
  print_partner_id: number | null;
  print_partner_name: string | null;
  defect_reported: boolean;
  reprint_issued: boolean;
  tracking_url: string | null;
}

const STATUSES = [
  "pending",
  "paid",
  "queued",
  "printing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-primary-surface text-primary-ink",
  queued: "bg-primary-surface text-primary-ink",
  printing: "bg-warning-surface text-warning-ink",
  shipped: "bg-success-surface text-success-ink",
  delivered: "bg-success-surface text-success-ink",
  cancelled: "bg-danger-surface text-danger-ink",
  refunded: "bg-danger-surface text-danger-ink",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "printing", label: "Printing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "defects", label: "Defects" },
];

const OPEN_STATUSES = ["pending", "paid", "queued", "printing"];

export default function AdminOrdersPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api.get<AdminOrder[]>("/api/admin/management/orders"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/admin/management/orders/${id}/status?status=${status}`),
    onSuccess: () => {
      toast.success("Order status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update order status"),
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

  const all = orders || [];
  const visible = all.filter((o) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "open"
        ? OPEN_STATUSES.includes(o.status)
        : filter === "defects"
        ? o.defect_reported
        : o.status === filter;
    const term = search.trim().toLowerCase().replace(/^#/, "");
    const matchesSearch =
      !term ||
      String(o.id).includes(term) ||
      (o.customer_email || "").toLowerCase().includes(term) ||
      (o.customer_name || "").toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const revenue = all
    .filter((o) => !["cancelled", "refunded"].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader
          icon={ShoppingCart}
          title="Order Management"
          description="Track platform-wide orders, fulfilment partners and reported defects."
        />

        <AdminStats
          stats={[
            { label: "Total Orders", value: all.length },
            {
              label: "Open",
              value: all.filter((o) => OPEN_STATUSES.includes(o.status)).length,
              accent: "text-ember",
            },
            {
              label: "Defects Reported",
              value: all.filter((o) => o.defect_reported).length,
              accent: "text-destructive",
            },
            {
              label: "Gross Revenue",
              value: `$${revenue.toFixed(2)}`,
              accent: "text-success",
            },
          ]}
        />

        <AdminToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by order #, customer name or email…"
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
                  <th className="px-4 py-4 font-semibold text-right">Items</th>
                  <th className="px-4 py-4 font-semibold text-right">Total</th>
                  <th className="px-4 py-4 font-semibold">Partner</th>
                  <th className="px-4 py-4 font-semibold">Date</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Flags</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4 font-data text-foreground">
                      #{o.id}
                      {o.mode && <p className="text-[10px] opacity-70 uppercase">{o.mode}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">
                        {o.customer_name || `User ${o.customer_id}`}
                      </p>
                      {o.customer_email && <p className="text-xs">{o.customer_email}</p>}
                    </td>
                    <td className="px-4 py-4 font-data text-right">{o.item_count}</td>
                    <td className="px-4 py-4 font-data text-right text-foreground">
                      ${o.total.toFixed(2)}
                      {o.shipping_cost > 0 && (
                        <p className="text-[10px] opacity-70">
                          +${o.shipping_cost.toFixed(2)} ship
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {o.print_partner_name || (
                        <span className="text-xs opacity-60">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-data whitespace-nowrap">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={o.status}
                        tone={STATUS_TONE[o.status] || "bg-muted text-muted-foreground"}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {o.defect_reported && (
                          <span className="text-destructive text-xs font-semibold">Defect</span>
                        )}
                        {o.reprint_issued && (
                          <span className="text-moss text-xs font-semibold">
                            Reprinted
                          </span>
                        )}
                        {!o.defect_reported && !o.reprint_issued && (
                          <span className="text-xs opacity-60">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          className="bg-background border border-border rounded text-xs p-1"
                          value={o.status}
                          onChange={(e) =>
                            updateStatus.mutate({ id: o.id, status: e.target.value })
                          }
                          disabled={updateStatus.isPending}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {o.tracking_url && (
                          <a
                            href={o.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Open tracking"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                      {all.length === 0 ? "No orders found." : "No orders match this filter."}
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
