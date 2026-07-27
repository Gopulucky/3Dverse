"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Printer,
  Plus,
  Trash2,
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
  { value: "fdm", label: "FDM (Fused Deposition)" },
  { value: "sla", label: "SLA (Stereolithography)" },
  { value: "sls", label: "SLS (Selective Laser Sintering)" },
  { value: "slm", label: "SLM (Selective Laser Melting)" },
  { value: "dmls", label: "DMLS (Direct Metal Laser Sintering)" },
  { value: "ebm", label: "EBM (Electron Beam Melting)" },
  { value: "mjf", label: "MJF (Multi Jet Fusion)" },
  { value: "material_jetting", label: "Material Jetting (PolyJet)" },
  { value: "binder_jetting", label: "Binder Jetting" },
  { value: "ded", label: "DED (Directed Energy Deposition)" },
  { value: "sheet_lamination", label: "Sheet Lamination" },
];

interface PrinterData {
  id: number;
  label: string;
  technology: string;
  material_form: string;
  status: "active" | "maintenance" | "offline";
  added_at: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle2 size={14} className="text-success" />,
  maintenance: <AlertCircle size={14} className="text-warning" />,
  offline: <WifiOff size={14} className="text-destructive" />,
};

export default function MyPrintersPage() {
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", technology: "fdm" });

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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/creator/printers/${id}`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/creator/printers/${id}`),
    onSuccess: () => {
      toast.success("Printer removed");
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to delete"),
  });

  if (!isAuthenticated) return null;

  function resetForm() {
    setShowForm(false);
    setForm({ label: "", technology: "fdm" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      label: form.label || null,
      technology: form.technology,
    });
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
            Register your 3D printers and their technology, and keep their status current.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add Printer
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-6 mb-8 border-primary/30 bg-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold font-display">Add New Printer</h2>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X size={16} />
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Name (optional)</Label>
                <Input
                  placeholder='e.g. "Bambu Lab X1 Carbon #1"'
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
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

            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                Add Printer
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {printers.length === 0 && !showForm ? (
        <Card className="p-12 text-center border-border">
          <Cpu size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2 font-display">No printers yet</h2>
          <p className="text-muted-foreground mb-6">
            Register your printers so orders can be routed and material inventory tracked correctly.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add Your First Printer
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {printers.map((p) => (
            <Card
              key={p.id}
              className="p-6 border-border bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate font-display">{p.label}</h3>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">
                    {p.technology}
                  </p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1 ml-4 shrink-0">
                  {STATUS_ICON[p.status]}
                  {p.status}
                </Badge>
              </div>

              <div className="text-sm mb-4">
                <span className="text-muted-foreground">Material</span>
                <p className="font-semibold capitalize">{p.material_form.replace(/_/g, " ")}</p>
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
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
