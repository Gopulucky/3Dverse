"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
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

interface AdminUser {
  id: number;
  email: string;
  role: string;
  full_name: string | null;
  company_name: string | null;
  pincode: string | null;
  created_at: string | null;
  is_active: boolean;
  order_count: number;
  product_count: number;
  is_self: boolean;
}

const ROLES = ["customer", "creator", "print_partner", "admin"];

const ROLE_TONE: Record<string, string> = {
  admin: "bg-danger-surface text-danger-ink",
  creator: "bg-warning-surface text-warning-ink",
  print_partner: "bg-success-surface text-success-ink",
  customer: "bg-muted text-muted-foreground",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "creator", label: "Creators" },
  { value: "print_partner", label: "Partners" },
  { value: "customer", label: "Customers" },
  { value: "suspended", label: "Suspended" },
];

export default function AdminUsersPage() {
  const { ready: isAuthenticated, user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<AdminUser[]>("/api/admin/management/users"),
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api.patch(`/api/admin/management/users/${id}/role?role=${role}`),
    onSuccess: () => {
      toast.success("Role updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update role"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/api/admin/management/users/${id}/status?is_active=${is_active}`),
    onSuccess: (_data, vars) => {
      toast.success(vars.is_active ? "User reactivated." : "User suspended.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update status"),
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

  const all = users || [];
  const visible = all.filter((u) => {
    const matchesFilter =
      filter === "all" ? true : filter === "suspended" ? !u.is_active : u.role === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      u.email.toLowerCase().includes(term) ||
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.company_name || "").toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const count = (role: string) => all.filter((u) => u.role === role).length;

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <AdminPageHeader
          icon={Users}
          title="User Management"
          description="View, re-role and suspend every account on the platform."
        />

        <AdminStats
          stats={[
            { label: "Total Users", value: all.length },
            { label: "Creators", value: count("creator") },
            { label: "Print Partners", value: count("print_partner") },
            {
              label: "Suspended",
              value: all.filter((u) => !u.is_active).length,
              accent: "text-destructive",
            },
          ]}
        />

        <AdminToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by email, name or company…"
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
                  <th className="px-4 py-4 font-semibold">User</th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                  <th className="px-4 py-4 font-semibold text-right">Orders</th>
                  <th className="px-4 py-4 font-semibold text-right">Products</th>
                  <th className="px-4 py-4 font-semibold">Joined</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4 font-data">{u.id}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">
                        {u.full_name || u.email.split("@")[0]}
                        {u.is_self && (
                          <span className="ml-2 text-[10px] uppercase font-bold text-foreground">You</span>
                        )}
                      </p>
                      <p className="text-xs">{u.email}</p>
                      {u.company_name && <p className="text-xs opacity-70">{u.company_name}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={u.role.replace("_", " ")}
                        tone={ROLE_TONE[u.role] || "bg-muted text-muted-foreground"}
                      />
                    </td>
                    <td className="px-4 py-4 font-data text-right">{u.order_count}</td>
                    <td className="px-4 py-4 font-data text-right">{u.product_count}</td>
                    <td className="px-4 py-4 font-data whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        label={u.is_active ? "Active" : "Suspended"}
                        tone={
                          u.is_active
                            ? "bg-success-surface text-success-ink"
                            : "bg-danger-surface text-danger-ink"
                        }
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          className="bg-background border border-border rounded text-xs p-1 disabled:opacity-40"
                          value={u.role}
                          disabled={u.is_self || updateRole.isPending}
                          title={u.is_self ? "You cannot change your own role" : "Change role"}
                          onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.is_self || updateStatus.isPending}
                          title={u.is_self ? "You cannot suspend your own account" : undefined}
                          onClick={() =>
                            updateStatus.mutate({ id: u.id, is_active: !u.is_active })
                          }
                        >
                          {u.is_active ? "Suspend" : "Restore"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      {all.length === 0 ? "No users found." : "No users match this filter."}
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
