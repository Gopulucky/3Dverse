"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  User,
  MapPin,
  Bell,
  Lock,
  Save,
  ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireRole } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { DeleteAccountCard } from "@/components/settings/delete-account";

const NOTIFICATION_PREFS = [
  { key: "order_updates", label: "Order updates", description: "Shipping, printing and delivery status" },
  { key: "price_drops", label: "Price drops", description: "When something on your wishlist gets cheaper" },
  { key: "new_drops", label: "New drops", description: "New designs from creators you follow" },
  { key: "promotions", label: "Promotions", description: "Deals, coupons and seasonal offers" },
];

const PREFS_STORAGE_KEY = "customer_notification_prefs";

export default function CustomerSettingsPage() {
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireRole([
    "customer",
    "creator",
    "print_partner",
    "admin",
  ]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => api.get<any>("/api/users/me"),
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState({
    full_name: "",
    pincode: "",
  });

  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });

  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    order_updates: true,
    price_drops: true,
    new_drops: false,
    promotions: false,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        pincode: profile.pincode || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    const saved = localStorage.getItem(PREFS_STORAGE_KEY);
    if (saved) {
      try {
        setPrefs((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {
        // ignore malformed prefs
      }
    }
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/api/users/me", data),
    onSuccess: () => {
      toast.success("Account updated!");
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update account"),
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
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    updateMutation.mutate({
      full_name: form.full_name || null,
      pincode: form.pincode || null,
    });
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Settings className="text-primary" />
          Account Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your shopping profile, delivery details and notification preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Info */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <User size={18} />
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Full Name</Label>
              <Input
                placeholder="Your full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Email</Label>
              <Input value={profile?.email || ""} disabled className="opacity-60" />
            </div>
          </div>
        </Card>

        {/* Delivery */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <MapPin size={18} />
            Delivery
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            We route your orders to the nearest print partner using this pincode.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Default Pincode</Label>
              <Input
                placeholder="e.g. 560001"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Bell size={18} />
            Notifications
          </h2>
          <div className="space-y-3">
            {NOTIFICATION_PREFS.map((pref) => (
              <label
                key={pref.key}
                className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={!!prefs[pref.key]}
                  onChange={(e) => setPrefs({ ...prefs, [pref.key]: e.target.checked })}
                />
                <div>
                  <p className="text-sm font-semibold">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateMutation.isPending}>
            <Save size={18} />
            Save Settings
          </Button>
        </div>
      </form>

      {/* Password (separate form) */}
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

      <Card className="p-6 border-border mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShoppingBag size={18} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Order history</p>
            <p className="text-xs text-muted-foreground">Track, return or reorder past purchases.</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/orders">View Orders</Link>
        </Button>
      </Card>

      <DeleteAccountCard email={profile?.email || ""} />
    </div>
  );

  return (
    <MarketplaceShell>
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-20 space-y-6">
          <Skeleton className="h-10 w-64" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </MarketplaceShell>
  );
}
