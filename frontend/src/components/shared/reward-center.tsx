"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles } from "lucide-react";

export function RewardCenter() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ points_balance: number }>("/api/creator/financial/rewards/balance")
      .then((d) => setBalance(d.points_balance))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const redeem = async (points: number) => {
    setRedeeming(true);
    setRedeemResult(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/creator/financial/rewards/redeem?points=${points}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Redemption failed");
      }
      const result = await res.json();
      setRedeemResult(`Redeemed for ${result.grams_awarded}g of filament!`);
      setBalance((prev) => prev - points);
    } catch (e: any) {
      setRedeemResult(e.message || "Redemption failed");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Card className="p-6 border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Gift className="text-primary" size={20} />
          </div>
          <div>
            <h3 className="font-semibold font-display text-foreground">
              Reward Points
            </h3>
            <p className="text-xs text-muted-foreground">
              Earn points on production — redeem for free filament
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-data text-foreground">
            {loading ? "—" : balance.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            points
          </p>
        </div>
      </div>

      {/* Redemption tiers */}
      <div className="flex gap-2 mt-4">
        {[50, 100, 250].map((pts) => (
          <button
            key={pts}
            disabled={redeeming || balance < pts}
            onClick={() => redeem(pts)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all border
              ${
                balance >= pts
                  ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50 cursor-pointer"
                  : "border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
              }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles size={14} />
              <span>{pts}</span>
            </div>
            <p className="text-[11px] mt-0.5 font-normal opacity-70">
              {pts * 10}g filament
            </p>
          </button>
        ))}
      </div>

      {redeemResult && (
        <Badge className="mt-3 bg-success-surface text-success-ink border-transparent text-xs w-full justify-center py-1.5">
          {redeemResult}
        </Badge>
      )}
    </Card>
  );
}
