"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  User,
  Building2,
  MapPin,
  Gauge,
  Layers,
  Lock,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireRole } from "@/stores/auth-store";
import { ConsoleShell } from "@/components/layout/console-shell";
import { DeleteAccountCard } from "@/components/settings/delete-account";

const MATERIAL_OPTIONS = ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Resin", "Carbon Fiber"];
const COLOR_OPTIONS = ["Black", "White", "Grey", "Red", "Blue", "Green", "Yellow", "Transparent"];

export default function PartnerSettingsPage() {
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireRole(["print_partner", "admin"]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => api.get<any>("/api/users/me"),
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    tax_id: "",
    pincode: "",
    latitude: "",
    longitude: "",
    capacity: "",
    materials: [] as string[],
    colors: [] as string[],
  });

  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        company_name: profile.company_name || "",
        tax_id: profile.tax_id || "",
        pincode: profile.pincode || "",
        latitude: profile.latitude != null ? String(profile.latitude) : "",
        longitude: profile.longitude != null ? String(profile.longitude) : "",
        capacity: profile.capacity != null ? String(profile.capacity) : "",
        materials: profile.capabilities?.materials || [],
        colors: profile.capabilities?.colors || [],
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/api/users/me", data),
    onSuccess: () => {
      toast.success("Facility settings updated!");
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update settings"),
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

  function toggle(field: "materials" | "colors", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      full_name: form.full_name || null,
      company_name: form.company_name || null,
      tax_id: form.tax_id || null,
      pincode: form.pincode || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      capabilities:
        form.materials.length || form.colors.length
          ? { materials: form.materials, colors: form.colors }
          : null,
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

  const chipClass = (selected: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
      selected
        ? "bg-primary/15 border-primary text-primary"
        : "border-border text-muted-foreground hover:border-primary/30"
    }`;

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Settings className="text-primary" />
          Print Partner Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Facility details, service area and print capabilities used to route jobs to you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Operator */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <User size={18} />
            Operator
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Contact Name</Label>
              <Input
                placeholder="Facility contact"
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

        {/* Facility */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Building2 size={18} />
            Facility
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Print Shop Name</Label>
              <Input
                placeholder="Your print shop name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">GST / Tax ID</Label>
              <Input
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Service Area */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <MapPin size={18} />
            Service Area
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Orders are matched to the closest partner. Coordinates are optional but improve routing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="mb-2 block">Pincode</Label>
              <Input
                placeholder="e.g. 560001"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Latitude</Label>
              <Input
                placeholder="12.9716"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Longitude</Label>
              <Input
                placeholder="77.5946"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Capacity */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Gauge size={18} />
            Capacity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Prints per week</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 100"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Capabilities */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Layers size={18} />
            Print Capabilities
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Materials you can print</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {MATERIAL_OPTIONS.map((m) => (
              <button key={m} type="button" onClick={() => toggle("materials", m)} className={chipClass(form.materials.includes(m))}>
                {m}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mb-3">Colors you stock</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button key={c} type="button" onClick={() => toggle("colors", c)} className={chipClass(form.colors.includes(c))}>
                {c}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateMutation.isPending}>
            <Save size={18} />
            Save Settings
          </Button>
        </div>
      </form>

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

      <DeleteAccountCard
        email={profile?.email || ""}
        note="Any jobs still assigned to your facility will need reassigning by an admin."
      />
    </div>
  );

  return (
    <ConsoleShell>
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
    </ConsoleShell>
  );
}
