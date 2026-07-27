"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  Package,
  Download,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { cn, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success-surface text-success-ink",
  queued: "bg-primary-surface text-primary-ink",
  printing: "bg-warning-surface text-warning-ink",
  qc: "bg-warning-surface text-warning-ink",
  packed: "bg-warning-surface text-warning-ink",
  shipped: "bg-success-surface text-success-ink",
  delivered: "bg-success-surface text-success-ink",
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "queued", label: "Queued" },
  { value: "printing", label: "Printing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

export default function CreatorOrdersPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["creator-orders", status],
    queryFn: () =>
      api.get<any>("/api/creator/orders", status ? { status } : undefined),
    enabled: isAuthenticated,
  });


  if (!isAuthenticated) return null;

  const orders = data?.orders ?? [];
  const counts = data?.status_counts ?? {};

  return (
    <StudioShell>
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <ClipboardList className="text-primary" />
            Orders
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Every order that includes one of your designs —{" "}
            <span className="font-data">{data?.total ?? 0}</span> total.
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                status === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
              )}
            >
              {f.label}
              {f.value && counts[f.value] ? (
                <span className="ml-1.5 font-data text-xs opacity-80">
                  {counts[f.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-12 text-center border-border bg-card">
            <Package className="mx-auto mb-4 text-muted-foreground" size={40} />
            <p className="text-muted-foreground mb-1 font-display text-lg">
              No orders {status && `with status "${status}"`} yet
            </p>
            <p className="text-sm text-muted-foreground">
              Orders appear here the moment a customer buys one of your designs.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o: any) => (
              <Card
                key={o.order_item_id}
                className="p-4 border-border bg-card flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                  {o.product_thumbnail ? (
                    <img
                      src={api.mediaUrl(o.product_thumbnail)}
                      alt={o.product_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package size={20} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/creator/products/${o.product_id}`}
                      className="font-bold text-foreground hover:text-primary transition-colors font-display truncate"
                    >
                      {o.product_title}
                    </Link>
                    {o.quantity > 1 && (
                      <span className="text-sm text-muted-foreground font-data">
                        ×{o.quantity}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {o.is_physical ? (
                        <>
                          <MapPin size={12} />
                          Print · {o.ship_city || "—"}
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          Digital
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-data">
                    Order #{o.order_id} · {o.buyer_name} · {formatDate(o.created_at)}
                  </p>
                  {Object.keys(o.selected_config || {}).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {Object.entries(o.selected_config)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {o.tracking_url && (
                    <a
                      href={o.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline text-xs flex items-center gap-1"
                    >
                      Track <ExternalLink size={11} />
                    </a>
                  )}
                  <Badge
                    className={cn(
                      "border-transparent capitalize",
                      STATUS_STYLES[o.status] || "bg-muted text-muted-foreground"
                    )}
                  >
                    {o.status}
                  </Badge>
                  <span className="font-data font-bold text-foreground w-20 text-right">
                    ${o.amount.toFixed(2)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StudioShell>
  );
}
