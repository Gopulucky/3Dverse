"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  User,
  Lock,
  Save,
  Store,
  Palette,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/stores/auth-store";
import { AdminShell } from "@/components/layout/admin-shell";

const PORTAL_SETTINGS = [
  {
    href: "/settings",
    label: "Customer Settings",
    description: "Shopping profile, delivery and notifications",
    icon: Store,
    iconClass: "text-primary",
  },
  {
    href: "/creator/settings",
    label: "Creator Settings",
    description: "Business identity and specializations",
    icon: Palette,
    iconClass: "text-ember",
  },
  {
    href: "/partner/settings",
    label: "Print Partner Settings",
    description: "Facility, service area and capabilities",
    icon: Printer,
    iconClass: "text-moss",
  },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireRole(["admin"]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => api.get<any>("/api/users/me"),
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState({ full_name: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || "" });
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/api/users/me", data),
    onSuccess: () => {
      toast.success("Admin profile updated!");
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update profile"),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => api.put("/api/users/me/password", data),
    onSuccess: () => {
      toast.success("Password updated!");
      setPasswords({ current_password: "", new_password: "" });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update password"),
  });

  if (!isAuthenticated) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({ full_name: form.full_name || null });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwords.current_password || !passwords.new_password) {
      toast.error("Enter both your current and new password");
      return;
    }
    passwordMutation.mutate(passwords);
  }

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Settings className="text-foreground" />
            Admin Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your admin account, plus every portal's settings in one place.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <ShieldAlert size={14} className="mr-1" />
          Administrator
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <User size={18} />
            Admin Account
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Full Name</Label>
              <Input
                placeholder="Your full name"
                value={form.full_name}
                onChange={(e) => setForm({ full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Email</Label>
              <Input value={profile?.email || ""} disabled className="opacity-60" />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateMutation.isPending}>
            <Save size={18} />
            Save Settings
          </Button>
        </div>
      </form>

      {/* Portal settings shortcuts */}
      <Card className="p-6 border-border mt-8">
        <h2 className="text-lg font-bold mb-1 font-display">Portal Settings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          As an admin you can open the settings page of any portal.
        </p>
        <div className="space-y-2">
          {PORTAL_SETTINGS.map((portal) => (
            <button
              key={portal.href}
              type="button"
              onClick={() => router.push(portal.href)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/40 transition-colors text-left"
            >
              <portal.icon size={18} className={portal.iconClass} />
              <div>
                <p className="text-sm font-semibold">{portal.label}</p>
                <p className="text-xs text-muted-foreground">{portal.description}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Deletion — admins cannot self-delete, so point at the right path */}
      <Card className="p-6 border-danger-red/40 mt-8">
        <h2 className="text-lg font-bold mb-1 font-display flex items-center gap-2 text-destructive">
          <ShieldAlert size={18} />
          Delete Account
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Admin accounts cannot delete themselves — that would risk locking everyone out
          of the platform. Ask another admin to remove this account, or manage other
          users' accounts from the Users page.
        </p>
        <Button variant="outline" onClick={() => router.push("/admin/users")}>
          Go to User Management
        </Button>
      </Card>

      {/* Password */}
      <Card className="p-6 border-border mt-8">
        <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
          <Lock size={18} />
          Password
        </h2>
        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Current Password</Label>
            <Input
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-2 block">New Password</Label>
            <Input
              type="password"
              value={passwords.new_password}
              onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" variant="outline" disabled={passwordMutation.isPending}>
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );

  return (
    <AdminShell>
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-20 space-y-6">
          <Skeleton className="h-10 w-64" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </AdminShell>
  );
}
