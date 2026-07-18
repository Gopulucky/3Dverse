"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Plus,
  Edit,
  Trash2,
  Wrench,
  Cpu,
  X,
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";

const TECHNOLOGIES = [
  { value: "FDM", label: "FDM (Fused Deposition)" },
  { value: "SLA", label: "SLA (Stereolithography)" },
  { value: "SLS", label: "SLS (Selective Laser Sintering)" },
  { value: "MJF", label: "MJF (Multi Jet Fusion)" },
  { value: "DLP", label: "DLP (Digital Light Processing)" },
  { value: "DMLS", label: "DMLS (Direct Metal)" },
  { value: "Other", label: "Other" },
];

interface PrinterData {
  id: number;
  name: string;
  technology: string;
  brand?: string;
  model?: string;
  build_volume_x?: number;
  build_volume_y?: number;
  build_volume_z?: number;
  nozzle_diameter?: number;
  heated_bed: boolean;
  enclosure: boolean;
  multi_color: boolean;
  auto_leveling: boolean;
  status: string;
  avg_print_speed?: number;
  max_prints_per_week?: number;
  maintenance_log?: any[];
  last_maintenance_at?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle2 size={14} className="text-success" />,
  maintenance: <AlertCircle size={14} className="text-warning" />,
  offline: <WifiOff size={14} className="text-destructive" />,
};

export default function MyPrintersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    technology: "FDM",
    brand: "",
    model: "",
    build_volume_x: "",
    build_volume_y: "",
    build_volume_z: "",
    nozzle_diameter: "0.4",
    heated_bed: true,
    enclosure: false,
    multi_color: false,
    auto_leveling: false,
    avg_print_speed: "",
    max_prints_per_week: "",
  });

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["creator-printers"],
    queryFn: () => api.get<PrinterData[]>("/api/creator/printers"),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/creator/printers", data),
    onSuccess: () => {
      toast.success("Printer added!");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.detail || "Failed to add printer"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/api/creator/printers/${id}`, data),
    onSuccess: () => {
      toast.success("Printer updated!");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update printer"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/creator/printers/${id}`),
    onSuccess: () => {
      toast.success("Printer removed");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to delete"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/creator/printers/${id}`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
    },
  });


  if (!isAuthenticated) return null;

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: "", technology: "FDM", brand: "", model: "",
      build_volume_x: "", build_volume_y: "", build_volume_z: "",
      nozzle_diameter: "0.4", heated_bed: true, enclosure: false,
      multi_color: false, auto_leveling: false,
      avg_print_speed: "", max_prints_per_week: "",
    });
  }

  function startEdit(p: PrinterData) {
    setEditingId(p.id);
    setShowForm(true);
    setForm({
      name: p.name, technology: p.technology, brand: p.brand || "",
      model: p.model || "",
      build_volume_x: p.build_volume_x?.toString() || "",
      build_volume_y: p.build_volume_y?.toString() || "",
      build_volume_z: p.build_volume_z?.toString() || "",
      nozzle_diameter: p.nozzle_diameter?.toString() || "0.4",
      heated_bed: p.heated_bed, enclosure: p.enclosure,
      multi_color: p.multi_color, auto_leveling: p.auto_leveling,
      avg_print_speed: p.avg_print_speed?.toString() || "",
      max_prints_per_week: p.max_prints_per_week?.toString() || "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      technology: form.technology,
      brand: form.brand || null,
      model: form.model || null,
      build_volume_x: form.build_volume_x ? parseFloat(form.build_volume_x) : null,
      build_volume_y: form.build_volume_y ? parseFloat(form.build_volume_y) : null,
      build_volume_z: form.build_volume_z ? parseFloat(form.build_volume_z) : null,
      nozzle_diameter: form.nozzle_diameter ? parseFloat(form.nozzle_diameter) : null,
      heated_bed: form.heated_bed,
      enclosure: form.enclosure,
      multi_color: form.multi_color,
      auto_leveling: form.auto_leveling,
      avg_print_speed: form.avg_print_speed ? parseFloat(form.avg_print_speed) : null,
      max_prints_per_week: form.max_prints_per_week ? parseInt(form.max_prints_per_week) : null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Printer className="text-primary" />
            My Printers
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your 3D printer fleet — add machines, track capabilities, and update status.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add Printer
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="p-6 mb-8 border-primary/30 bg-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold font-display">
              {editingId ? "Edit Printer" : "Add New Printer"}
            </h2>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X size={16} />
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name, Technology */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Printer Name *</Label>
                <Input
                  required
                  placeholder='e.g. "Bambu Lab X1 Carbon #1"'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Technology *</Label>
                <select
                  className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                  value={form.technology}
                  onChange={(e) => setForm({ ...form, technology: e.target.value })}
                >
                  {TECHNOLOGIES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Brand, Model */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Brand</Label>
                <Input
                  placeholder="e.g. Bambu Lab"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Model</Label>
                <Input
                  placeholder="e.g. X1 Carbon"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Build Volume */}
            <div>
              <Label className="mb-2 block">Build Volume (mm)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number" placeholder="X (width)" step="0.1"
                  value={form.build_volume_x}
                  onChange={(e) => setForm({ ...form, build_volume_x: e.target.value })}
                />
                <Input
                  type="number" placeholder="Y (depth)" step="0.1"
                  value={form.build_volume_y}
                  onChange={(e) => setForm({ ...form, build_volume_y: e.target.value })}
                />
                <Input
                  type="number" placeholder="Z (height)" step="0.1"
                  value={form.build_volume_z}
                  onChange={(e) => setForm({ ...form, build_volume_z: e.target.value })}
                />
              </div>
            </div>

            {/* Row 4: Nozzle + Speed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block">Nozzle Diameter (mm)</Label>
                <Input
                  type="number" step="0.05"
                  value={form.nozzle_diameter}
                  onChange={(e) => setForm({ ...form, nozzle_diameter: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Avg Speed (mm/s)</Label>
                <Input
                  type="number"
                  value={form.avg_print_speed}
                  onChange={(e) => setForm({ ...form, avg_print_speed: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Capacity (prints/week)</Label>
                <Input
                  type="number"
                  value={form.max_prints_per_week}
                  onChange={(e) => setForm({ ...form, max_prints_per_week: e.target.value })}
                />
              </div>
            </div>

            {/* Row 5: Feature toggles */}
            <div className="flex flex-wrap gap-4">
              {[
                { key: "heated_bed", label: "Heated Bed" },
                { key: "enclosure", label: "Enclosure" },
                { key: "multi_color", label: "Multi-Color" },
                { key: "auto_leveling", label: "Auto-Leveling" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.checked })
                    }
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Update Printer" : "Add Printer"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Printer Grid */}
      {printers.length === 0 && !showForm ? (
        <Card className="p-12 text-center border-border">
          <Cpu size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2 font-display">No printers yet</h2>
          <p className="text-muted-foreground mb-6">
            Add your 3D printers to manage capabilities, track maintenance, and accept orders.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add Your First Printer
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {printers.map((p: PrinterData) => (
            <Card
              key={p.id}
              className="p-6 border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate font-display">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.brand} {p.model}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {STATUS_ICON[p.status]}
                    {p.status}
                  </Badge>
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Technology</span>
                  <p className="font-semibold">{p.technology}</p>
                </div>
                {p.build_volume_x && (
                  <div>
                    <span className="text-muted-foreground">Build Volume</span>
                    <p className="font-semibold font-data">
                      {p.build_volume_x}×{p.build_volume_y}×{p.build_volume_z} mm
                    </p>
                  </div>
                )}
                {p.nozzle_diameter && (
                  <div>
                    <span className="text-muted-foreground">Nozzle</span>
                    <p className="font-semibold font-data">{p.nozzle_diameter} mm</p>
                  </div>
                )}
                {p.max_prints_per_week && (
                  <div>
                    <span className="text-muted-foreground">Capacity</span>
                    <p className="font-semibold font-data">{p.max_prints_per_week}/week</p>
                  </div>
                )}
              </div>

              {/* Feature badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {p.heated_bed && <Badge variant="outline" className="text-xs">Heated Bed</Badge>}
                {p.enclosure && <Badge variant="outline" className="text-xs">Enclosed</Badge>}
                {p.multi_color && <Badge variant="outline" className="text-xs">Multi-Color</Badge>}
                {p.auto_leveling && <Badge variant="outline" className="text-xs">Auto-Level</Badge>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                  <Edit size={14} />
                  Edit
                </Button>
                {/* Status cycle */}
                <select
                  className="bg-transparent border border-input text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-ring focus-visible:outline-none"
                  value={p.status}
                  onChange={(e) => statusMutation.mutate({ id: p.id, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="offline">Offline</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={() => {
                    if (confirm("Remove this printer?")) deleteMutation.mutate(p.id);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
