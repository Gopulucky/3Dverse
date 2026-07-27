"use client";

import { Card } from "@/components/ui/card";

interface TakeRateData {
  selling_price: number;
  gateway_fee: number;
  marketplace_commission: number;
  total_platform_take: number;
  total_take_rate_pct: number;
  creator_takeaway: number;
}

export function TakeRateBreakdown({ data }: { data: TakeRateData }) {
  return (
    <Card className="p-5 border-border bg-card">
      <h3 className="font-semibold mb-3 font-display text-foreground">
        What you keep on this order
      </h3>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm py-1">
          <span className="text-foreground">Selling Price</span>
          <span className="font-data font-semibold">
            ₹{data.selling_price.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm py-1 text-muted-foreground">
          <span>– Gateway Fee</span>
          <span className="font-data">₹{data.gateway_fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm py-1 text-muted-foreground">
          <span>– Marketplace Commission</span>
          <span className="font-data">
            ₹{data.marketplace_commission.toFixed(2)}
          </span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between text-sm py-1 font-semibold text-foreground">
          <span>
            Total platform take ({data.total_take_rate_pct}%)
          </span>
          <span className="font-data">
            ₹{data.total_platform_take.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-base pt-2 font-bold text-success">
          <span>You keep</span>
          <span className="font-data">
            ₹{data.creator_takeaway.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );
}
