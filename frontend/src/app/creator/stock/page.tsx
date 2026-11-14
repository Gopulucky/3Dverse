"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Boxes,
  Plus,
  AlertTriangle,
  X,
  History,
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

interface StockRow {
  id: number;
  product_id: number;
  product_title: string | null;
  on_hand: number;
  reserved: number;
  damaged: number;
  available: number;
  safety_stock: number;
  sellable: number;
  reorder_point: number;
  needs_reorder: boolean;
  updated_at: string | null;
}

interface Movement {
  id: number;
  quantity: number;
  reason: string;
  order_id: number | null;
  note: string | null;
  created_at: string | null;
}

interface CreatorProduct {
  id: number;
  title: string;
}

export default function StockPage() {
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [showForm, setShowForm] = useState(false);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [form, setForm] = useState({ product_id: "", on_hand: "0", safety_stock: "0", reorder_point: "0" });
  const [adjustFor, setAdjustFor] = useState<number | null>(null);
  const [adjustForm, setAdjustForm] = useState({ on_hand_delta: "0", damaged_delta: "0", note: "" });

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["creator-stock"],
    queryFn: () => api.get<StockRow[]>("/api/creator/stock/"),
    enabled: isAuthenticated,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["creator-products-for-stock"],
    queryFn: () => api.get<CreatorProduct[]>("/api/products/creator"),
    enabled: isAuthenticated,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", historyFor],
    queryFn: () => api.get<Movement[]>(`/api/creator/stock/${historyFor}/movements`),
    enabled: isAuthenticated && historyFor !== null,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/creator/stock/", data),
    onSuccess: () => {
      toast.success("Stock saved");
      queryClient.invalidateQueries({ queryKey: ["creator-stock"] });
      setShowForm(false);
      setForm({ product_id: "", on_hand: "0", safety_stock: "0", reorder_point: "0" });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to save stock"),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.post(`/api/creator/stock/${id}/adjust`, data),
    onSuccess: () => {
      toast.success("Adjustment recorded");
      queryClient.invalidateQueries({ queryKey: ["creator-stock"] });
      setAdjustFor(null);
      setAdjustForm({ on_hand_delta: "0", damaged_delta: "0", note: "" });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to adjust stock"),
  });

  if (!isAuthenticated) return null;

  const trackedProductIds = new Set(stock.map((s) => s.product_id));
  const untracked = products.filter((p) => !trackedProductIds.has(p.id));

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Boxes className="text-primary" />
            Stock
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Available, reserved, damaged and safety stock for your pre-made units. Orders reserve
            stock automatically at checkout; approved returns restock automatically.
          </p>
        </div>
        {!showForm && untracked.length > 0 && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Track a Product
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-6 mb-8 border-primary/30 bg-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold font-display">Start Tracking Stock</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X size={16} />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label className="mb-2 block">Product</Label>
              <select
                className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              >
                <option value="">Select a product…</option>
                {untracked.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-2 block">Units on hand</Label>
              <Input type="number" min={0} value={form.on_hand} onChange={(e) => setForm({ ...form, on_hand: e.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">Safety stock</Label>
              <Input type="number" min={0} value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <Label className="mb-2 block">Reorder point</Label>
            <Input type="number" min={0} value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} />
          </div>
          <Button
            className="mt-4"
            disabled={!form.product_id || upsertMutation.isPending}
            onClick={() =>
              upsertMutation.mutate({
                product_id: Number(form.product_id),
                on_hand: Number(form.on_hand) || 0,
                safety_stock: Number(form.safety_stock) || 0,
                reorder_point: Number(form.reorder_point) || 0,
              })
            }
          >
            Save
          </Button>
        </Card>
      )}

      {stock.length === 0 && !showForm ? (
        <Card className="p-12 text-center border-border">
          <Boxes size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2 font-display">No stock tracked yet</h2>
          <p className="text-muted-foreground mb-6">
            Track stock for a product to enable real-time availability and standard returns.
          </p>
          {untracked.length > 0 && (
            <Button onClick={() => setShowForm(true)}>
              <Plus size={18} />
              Track Your First Product
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stock.map((s) => (
            <Card key={s.id} className="p-6 border-border bg-card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold font-display truncate">{s.product_title}</h3>
                {s.needs_reorder && (
                  <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
                    <AlertTriangle size={12} /> Reorder
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Sellable</span>
                  <p className="font-semibold font-data text-lg">{s.sellable}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reserved</span>
                  <p className="font-semibold font-data">{s.reserved}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Damaged</span>
                  <p className="font-semibold font-data">{s.damaged}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {s.on_hand} on hand · {s.safety_stock} held back as safety stock
              </p>

              {adjustFor === s.id ? (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2 mb-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number" placeholder="On-hand change (+/-)"
                      value={adjustForm.on_hand_delta}
                      onChange={(e) => setAdjustForm({ ...adjustForm, on_hand_delta: e.target.value })}
                    />
                    <Input
                      type="number" placeholder="Damaged change (+/-)"
                      value={adjustForm.damaged_delta}
                      onChange={(e) => setAdjustForm({ ...adjustForm, damaged_delta: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="Note (e.g. physical count, breakage)"
                    value={adjustForm.note}
                    onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={adjustMutation.isPending}
                      onClick={() =>
                        adjustMutation.mutate({
                          id: s.id,
                          data: {
                            on_hand_delta: Number(adjustForm.on_hand_delta) || 0,
                            damaged_delta: Number(adjustForm.damaged_delta) || 0,
                            note: adjustForm.note || null,
                          },
                        })
                      }
                    >
                      Save Adjustment
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdjustFor(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setAdjustFor(s.id)}>Adjust</Button>
                  <Button variant="ghost" size="sm" onClick={() => setHistoryFor(historyFor === s.id ? null : s.id)}>
                    <History size={14} /> History
                  </Button>
                </div>
              )}

              {historyFor === s.id && (
                <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                  {movements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No movements yet.</p>
                  ) : (
                    movements.map((m) => (
                      <div key={m.id} className="flex justify-between text-xs text-muted-foreground border-b border-border/50 py-1">
                        <span className="capitalize">{m.reason.replace(/_/g, " ")}{m.order_id ? ` (order #${m.order_id})` : ""}</span>
                        <span className={m.quantity < 0 ? "text-destructive" : "text-success"}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
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
