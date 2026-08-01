"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Star, ExternalLink } from "lucide-react";
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

interface AdminProduct {
  id: number;
  title: string;
  category: string | null;
  status: string;
  is_published: boolean;
  is_featured: boolean;
  price: number;
  creator_id: number;
  creator_name: string | null;
  units_sold: number;
  safety_review_status: "pending" | "approved" | "rejected";
  safety_review_note: string | null;
  created_at: string | null;
}

const STATUSES = ["draft", "published", "delisted"];

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success-surface text-success-ink",
  delisted: "bg-danger-surface text-danger-ink",
};

const SAFETY_TONE: Record<string, string> = {
  pending: "bg-warning-surface text-warning-ink",
  approved: "bg-success-surface text-success-ink",
  rejected: "bg-danger-surface text-danger-ink",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "delisted", label: "Delisted" },
  { value: "featured", label: "Featured" },
  { value: "safety_pending", label: "Needs Safety Review" },
];

export default function AdminProductsPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api.get<AdminProduct[]>("/api/admin/management/products"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/admin/management/products/${id}/status?status=${status}`),
    onSuccess: () => {
      toast.success("Product status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update product status"),
  });

  const decideSafety = useMutation({
    mutationFn: ({ id, safety_review_status, note }: { id: number; safety_review_status: string; note?: string }) =>
      api.patch(`/api/admin/management/products/${id}/safety-review`, { safety_review_status, note }),
    onSuccess: () => {
      toast.success("Safety review decision recorded.");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to record safety review decision"),
  });

  const handleReject = (id: number) => {
    const note = window.prompt("Reason for rejecting this design (shown to the creator):");
    if (!note?.trim()) return;
    decideSafety.mutate({ id, safety_review_status: "rejected", note: note.trim() });
  };

  if (!isAuthenticated) return null;
  if (error) return <AdminAccessDenied detail={(error as any)?.detail} />;
  if (isLoading) {
    return (
      <AdminShell>
        <AdminTableSkeleton />
      </AdminShell>
    );
  }

  const all = products || [];
  const visible = all.filter((p) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "featured"
        ? p.is_featured
        : filter === "safety_pending"
        ? p.safety_review_status === "pending"
        : p.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.title.toLowerCase().includes(term) ||
      (p.creator_name || "").toLowerCase().includes(term) ||
      (p.category || "").toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const catalogValue = all.reduce((sum, p) => sum + p.price, 0);

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader
          icon={Package}
          title="Product Catalog"
          description="Moderate listings, review creators and delist policy violations."
        />

        <AdminStats
          stats={[
            { label: "Total Products", value: all.length },
            {
              label: "Published",
              value: all.filter((p) => p.status === "published").length,
              accent: "text-success",
            },
            {
              label: "Delisted",
              value: all.filter((p) => p.status === "delisted").length,
              accent: "text-destructive",
            },
            {
              label: "Needs Safety Review",
              value: all.filter((p) => p.safety_review_status === "pending").length,
              accent: "text-warning",
            },
          ]}
        />

        <AdminToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by title, creator or category…"
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
                  <th className="px-4 py-4 font-semibold">ID</th>
                  <th className="px-4 py-4 font-semibold">Product</th>
                  <th className="px-4 py-4 font-semibold">Creator</th>
                  <th className="px-4 py-4 font-semibold text-right">Price</th>
                  <th className="px-4 py-4 font-semibold text-right">Sold</th>
                  <th className="px-4 py-4 font-semibold">Created</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Safety Review</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4 font-data">{p.id}</td>
                    <td className="px-4 py-4 max-w-xs">
                      <p className="font-medium text-foreground flex items-center gap-1.5 truncate">
                        {p.is_featured && (
                          <Star size={12} className="text-foreground shrink-0 fill-current" />
                        )}
                        <span className="truncate">{p.title}</span>
                      </p>
                      {p.category && <p className="text-xs opacity-70">{p.category}</p>}
                    </td>
                    <td className="px-4 py-4">
                      {p.creator_name || (
                        <span className="text-xs opacity-60">User {p.creator_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-data text-right text-foreground">
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 font-data text-right">{p.units_sold}</td>
                    <td className="px-4 py-4 font-data whitespace-nowrap">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={p.status}
                        tone={STATUS_TONE[p.status] || "bg-muted text-muted-foreground"}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={p.safety_review_status}
                        tone={SAFETY_TONE[p.safety_review_status] || "bg-muted text-muted-foreground"}
                      />
                      {p.safety_review_status === "pending" && (
                        <div className="flex gap-1.5 mt-2">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => decideSafety.mutate({ id: p.id, safety_review_status: "approved" })}
                            disabled={decideSafety.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="text-destructive"
                            onClick={() => handleReject(p.id)}
                            disabled={decideSafety.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {p.safety_review_status === "rejected" && p.safety_review_note && (
                        <p className="text-xs text-destructive mt-1 max-w-[10rem] truncate" title={p.safety_review_note}>
                          {p.safety_review_note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          className="bg-background border border-border rounded text-xs p-1"
                          value={p.status}
                          onChange={(e) =>
                            updateStatus.mutate({ id: p.id, status: e.target.value })
                          }
                          disabled={updateStatus.isPending}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <a
                          href={`/marketplace/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="View listing"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                      {all.length === 0 ? "No products found." : "No products match this filter."}
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
