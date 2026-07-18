"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Beaker,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Package,
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

interface MaterialCatalog {
  id: number;
  name: string;
  category: string;
  technology_compatibility: string[];
  properties: Record<string, any>;
  min_wall_thickness: number | null;
  max_temp: number | null;
  color_options: string[];
  food_safe: boolean;
  flame_retardant: boolean;
  biocompatible: boolean;
  uv_stable: boolean;
  recyclable: boolean;
  description: string | null;
}

interface CreatorMat {
  id: number;
  creator_id: number;
  material_id: number;
  in_stock: boolean;
  colors_available: string[];
  price_per_gram: number | null;
  brand_used: string | null;
  notes: string | null;
  material: MaterialCatalog | null;
}

interface FinishOpt {
  id: number;
  name: string;
  description: string | null;
  additional_cost: number;
  estimated_extra_days: number;
}

const CERT_BADGES: { key: string; label: string; color: string }[] = [
  { key: "food_safe", label: "Food Safe", color: "text-success" },
  { key: "flame_retardant", label: "Fire Retardant", color: "text-warning" },
  { key: "biocompatible", label: "Biocompatible", color: "text-primary" },
  { key: "uv_stable", label: "UV Stable", color: "text-amber-500" },
  { key: "recyclable", label: "Recyclable", color: "text-emerald-500" },
];

export default function MaterialsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [showFinishForm, setShowFinishForm] = useState(false);
  const [finishForm, setFinishForm] = useState({
    name: "",
    description: "",
    additional_cost: "",
    estimated_extra_days: "0",
  });

  // Catalog of all platform materials
  const { data: catalog = [] } = useQuery({
    queryKey: ["material-catalog"],
    queryFn: () => api.get<MaterialCatalog[]>("/api/creator/materials/catalog"),
    enabled: isAuthenticated,
  });

  // Creator's stocked materials
  const { data: myMaterials = [], isLoading } = useQuery({
    queryKey: ["creator-materials"],
    queryFn: () => api.get<CreatorMat[]>("/api/creator/materials/my-materials"),
    enabled: isAuthenticated,
  });

  // Creator's finish options
  const { data: finishes = [] } = useQuery({
    queryKey: ["creator-finishes"],
    queryFn: () => api.get<FinishOpt[]>("/api/creator/materials/finishes"),
    enabled: isAuthenticated,
  });

  const addMaterialMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/creator/materials/my-materials", data),
    onSuccess: () => {
      toast.success("Material added to stock!");
      queryClient.invalidateQueries({ queryKey: ["creator-materials"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to add material"),
  });

  const removeMaterialMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/creator/materials/my-materials/${id}`),
    onSuccess: () => {
      toast.success("Material removed");
      queryClient.invalidateQueries({ queryKey: ["creator-materials"] });
    },
  });

  const addFinishMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/creator/materials/finishes", data),
    onSuccess: () => {
      toast.success("Finish option added!");
      queryClient.invalidateQueries({ queryKey: ["creator-finishes"] });
      setShowFinishForm(false);
      setFinishForm({ name: "", description: "", additional_cost: "", estimated_extra_days: "0" });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to add finish"),
  });

  const removeFinishMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/creator/materials/finishes/${id}`),
    onSuccess: () => {
      toast.success("Finish removed");
      queryClient.invalidateQueries({ queryKey: ["creator-finishes"] });
    },
  });


  if (!isAuthenticated) return null;

  const myMaterialIds = new Set(myMaterials.map((m) => m.material_id));
  const availableCatalog = catalog.filter((m) => !myMaterialIds.has(m.id));

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Beaker className="text-primary" />
          Materials & Finishes
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Declare what materials you stock and what finishes you offer to customers.
        </p>
      </div>

      {/* My Materials Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold mb-4 font-display flex items-center gap-2">
          <Package size={20} />
          My Material Stock ({myMaterials.length})
        </h2>

        {myMaterials.length === 0 ? (
          <Card className="p-8 text-center border-border">
            <Beaker size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              You haven't added any materials yet. Select from the catalog below.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myMaterials.map((cm) => (
              <Card
                key={cm.id}
                className="p-4 border-border bg-card hover:border-primary/30 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold font-display">{cm.material?.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {cm.material?.category}
                    </p>
                  </div>
                  <Badge
                    variant={cm.in_stock ? "success" : "secondary"}
                    className="text-xs"
                  >
                    {cm.in_stock ? "In Stock" : "Out"}
                  </Badge>
                </div>

                {/* Tech compatibility */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {cm.material?.technology_compatibility?.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>

                {/* Certifications */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {CERT_BADGES.map(
                    ({ key, label, color }) =>
                      cm.material &&
                      (cm.material as any)[key] && (
                        <span key={key} className={`text-[10px] ${color} flex items-center gap-0.5`}>
                          <CheckCircle2 size={10} />
                          {label}
                        </span>
                      )
                  )}
                </div>

                {cm.brand_used && (
                  <p className="text-xs text-muted-foreground mb-1">
                    Brand: <span className="text-foreground">{cm.brand_used}</span>
                  </p>
                )}
                {cm.price_per_gram && (
                  <p className="text-xs text-muted-foreground mb-1">
                    Cost: <span className="text-foreground font-data">${cm.price_per_gram}/g</span>
                  </p>
                )}

                <div className="flex justify-end pt-2 border-t border-border mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeMaterialMutation.mutate(cm.id)}
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Available Catalog */}
      {availableCatalog.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 font-display">
            Add from Catalog ({availableCatalog.length} available)
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableCatalog.map((mat) => (
              <Card
                key={mat.id}
                className="p-4 border-border/50 bg-card/50 hover:border-primary/30 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold font-display">{mat.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {mat.category}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addMaterialMutation.mutate({ material_id: mat.id })
                    }
                    disabled={addMaterialMutation.isPending}
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {mat.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {mat.technology_compatibility?.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Finish Options */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <Sparkles size={20} />
            Finish Options ({finishes.length})
          </h2>
          {!showFinishForm && (
            <Button variant="outline" size="sm" onClick={() => setShowFinishForm(true)}>
              <Plus size={14} />
              Add Finish
            </Button>
          )}
        </div>

        {showFinishForm && (
          <Card className="p-4 mb-4 border-primary/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addFinishMutation.mutate({
                  name: finishForm.name,
                  description: finishForm.description || null,
                  additional_cost: finishForm.additional_cost
                    ? parseFloat(finishForm.additional_cost)
                    : 0,
                  estimated_extra_days: parseInt(finishForm.estimated_extra_days) || 0,
                });
              }}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div>
                <Label className="mb-1 block text-xs">Name *</Label>
                <Input
                  required
                  placeholder="e.g. Sanding"
                  value={finishForm.name}
                  onChange={(e) =>
                    setFinishForm({ ...finishForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Description</Label>
                <Input
                  placeholder="Optional details"
                  value={finishForm.description}
                  onChange={(e) =>
                    setFinishForm({ ...finishForm, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Extra Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={finishForm.additional_cost}
                  onChange={(e) =>
                    setFinishForm({ ...finishForm, additional_cost: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addFinishMutation.isPending}>
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFinishForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {finishes.length === 0 && !showFinishForm ? (
          <Card className="p-6 text-center border-border">
            <p className="text-muted-foreground text-sm">
              No finish options yet. Add post-processing options like sanding, painting, or vapor smoothing.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {finishes.map((f: FinishOpt) => (
              <Card key={f.id} className="p-4 border-border flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm">{f.name}</p>
                  {f.description && (
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  )}
                  {f.additional_cost > 0 && (
                    <p className="text-xs text-primary font-data mt-1">
                      +${f.additional_cost.toFixed(2)}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeFinishMutation.mutate(f.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
