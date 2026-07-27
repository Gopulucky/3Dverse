"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Spool {
  id: number;
  material_type: string;
  color: string;
  total_weight_g: number;
  remaining_weight_g: number;
  cost: number;
  cost_per_gram: number;
  is_depleted: boolean;
  purchase_date: string | null;
}

export function FilamentSpoolTable() {
  const [spools, setSpools] = useState<Spool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Spool[]>("/api/creator/financial/filament/spools")
      .then(setSpools)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-6 border-border bg-card">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-border bg-card">
      <h3 className="text-lg font-bold mb-4 font-display text-foreground">
        Filament Inventory
      </h3>
      {spools.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground text-sm">
            No filament spools tracked yet. Add your first spool to start
            tracking inventory.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="pb-2 pr-3 font-semibold">Material</th>
                <th className="pb-2 pr-3 font-semibold text-right">
                  Total (g)
                </th>
                <th className="pb-2 pr-3 font-semibold text-right">
                  Remaining (g)
                </th>
                <th className="pb-2 pr-3 font-semibold text-right">
                  ₹/gram
                </th>
                <th className="pb-2 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {spools.map((s) => {
                const pct =
                  s.total_weight_g > 0
                    ? (s.remaining_weight_g / s.total_weight_g) * 100
                    : 0;
                const isLow = !s.is_depleted && pct <= 20;

                return (
                  <tr
                    key={s.id}
                    className={`border-b border-border/50 last:border-0 transition-colors ${
                      isLow ? "bg-warning/5" : ""
                    } ${s.is_depleted ? "opacity-50" : ""}`}
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-foreground">
                        {s.material_type}
                      </span>
                      {s.color && (
                        <span className="text-muted-foreground ml-1.5">
                          — {s.color}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-data">
                      {s.total_weight_g.toFixed(0)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-data font-semibold">
                      {s.remaining_weight_g.toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-data">
                      ₹{s.cost_per_gram.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      {s.is_depleted ? (
                        <Badge className="bg-danger-surface text-danger-ink border-transparent text-[11px]">
                          Depleted
                        </Badge>
                      ) : isLow ? (
                        <Badge className="bg-warning-surface text-warning-ink border-transparent text-[11px]">
                          Reorder Soon
                        </Badge>
                      ) : (
                        <Badge className="bg-success-surface text-success-ink border-transparent text-[11px]">
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
