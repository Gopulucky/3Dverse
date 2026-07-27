"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, Plus, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

interface CommissionListItem {
  request: {
    id: number;
    title: string;
    workflow_status: string;
    payment_status: string;
    brief_fee: number;
    customer_id: number;
    creator_id: number;
    created_at: string;
  };
  counterparty_name: string;
}

const STATUS_TYPE: Record<string, "success" | "warning" | "in-progress" | "danger" | "neutral"> = {
  pending_payment: "warning",
  submitted: "warning",
  accepted: "in-progress",
  quoted: "in-progress",
  negotiating: "in-progress",
  agreed: "in-progress",
  delivered: "success",
  completed: "success",
  declined: "danger",
  cancelled: "neutral",
};

export default function CommissionsInboxPage() {
  const { ready, user } = useRequireAuth();
  const [items, setItems] = useState<CommissionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    api
      .get<CommissionListItem[]>("/api/custom-designs/requests")
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready) return null;

  const isCreator = user?.role === "creator";

  return (
    <MarketplaceShell>
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
              <Wand2 className="text-primary" />
              {isCreator ? "Commission Requests" : "My Custom Design Requests"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isCreator
                ? "Custom design work customers have commissioned from you."
                : "Bespoke designs you've commissioned from 3DVerse creators."}
            </p>
          </div>
          {!isCreator && (
            <Button asChild>
              <Link href="/commissions/browse">
                <Plus size={16} />
                Request a Custom Design
              </Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center shadow-sm">
            <p className="text-muted-foreground mb-6 font-display">
              {isCreator
                ? "No commissions yet — paid requests from customers will show up here."
                : "You haven't commissioned a custom design yet."}
            </p>
            {!isCreator && (
              <Button asChild>
                <Link href="/commissions/browse">Find a designer</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(({ request, counterparty_name }) => (
              <Link key={request.id} href={`/commissions/${request.id}`}>
                <Card className="p-5 hover:border-primary/40 hover:shadow-md transition-all flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold font-display truncate">{request.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isCreator ? "Customer" : "Creator"}: {counterparty_name} · Request #{request.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusChip
                      status={STATUS_TYPE[request.workflow_status] || "neutral"}
                      label={request.workflow_status.replace(/_/g, " ").toUpperCase()}
                    />
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MarketplaceShell>
  );
}
