"use client";
import { useEffect, useState } from "react";

interface Partner {
  print_partner_id: number;
  name: string;
  region: string;
  cost_tier: number;
  reship_rate: number;
  is_private_partnership: boolean;
}

export default function PartnerRecommendationPicker({ productId }: { productId: number }) {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/creator/designer/products/${productId}/recommended-partners`)
      .then(r => r.json()).then(setPartners);
  }, [productId]);

  const choose = async (partnerId: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/creator/designer/products/${productId}/assign-partner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_partner_id: partnerId }),
    });
    // optionally trigger a reload or callback
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-foreground">Choose a print partner</h3>
      <div className="space-y-2">
        {partners.map(p => (
          <div key={p.print_partner_id} className="flex justify-between items-center border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
            <div>
              <div className="font-medium text-foreground flex items-center gap-2">
                {p.name}
                {p.is_private_partnership && (
                  <span className="text-xs font-semibold bg-moss-3 text-moss-11 px-2 py-0.5 rounded-full">
                    Your partner
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {p.region} · Cost tier {"⭐".repeat(p.cost_tier || 1)} · Reship rate {(p.reship_rate * 100).toFixed(2)}%
              </div>
            </div>
            <button onClick={() => choose(p.print_partner_id)} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
              Select
            </button>
          </div>
        ))}
      </div>
      {partners.length === 0 && (
        <div className="text-sm text-muted-foreground italic py-4">No partners found for this technology/material.</div>
      )}
    </div>
  );
}
