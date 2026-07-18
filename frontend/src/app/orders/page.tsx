"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Download, ExternalLink, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { StatusChip } from "@/components/ui/status-chip";

const ORDER_STATUS_FLOW = [
  "pending",
  "paid",
  "queued",
  "printing",
  "qc",
  "packed",
  "shipped",
  "delivered",
];

function OrderStatusTracker({ status }: { status: string }) {
  const currentIdx = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-3 no-scrollbar">
      {ORDER_STATUS_FLOW.map((s, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
                isPast
                  ? "bg-calibration-cyan/15 text-calibration-cyan"
                  : isCurrent
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted text-muted-foreground/50"
              )}
            >
              {isPast && <CheckCircle2 size={10} />}
              {s}
            </div>
            {idx < ORDER_STATUS_FLOW.length - 1 && (
              <div
                className={cn(
                  "w-4 h-px mx-0.5",
                  isPast ? "bg-calibration-cyan" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<any[]>("/api/orders/"),
    enabled: isAuthenticated,
  });


  if (!isAuthenticated) return null;

  const getStatusType = (status: string) => {
    if (status === "delivered") return "success";
    if (status === "shipped") return "success";
    if (status === "pending" || status === "queued") return "warning";
    if (status === "printing" || status === "qc") return "in-progress";
    return "neutral";
  };

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <Package className="text-primary" />
        Order History
      </h1>

      {orders.length === 0 ? (
        <Card className="p-12 text-center border-border bg-card shadow-sm">
          <p className="text-muted-foreground mb-6 font-display">
            You haven&apos;t placed any orders yet.
          </p>
          <Button asChild>
            <Link href="/marketplace">Browse Marketplace</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order: any) => (
            <Card key={order.id} className="overflow-hidden border-border bg-card shadow-sm">
              {/* Header */}
              <div className="bg-muted/30 p-4 border-b border-border flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                    Order Placed
                  </p>
                  <p className="text-sm font-data">{formatDate(order.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                    Total
                  </p>
                  <p className="text-sm font-bold font-data text-foreground">
                    ${order.total?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                    Order #
                  </p>
                  <p className="text-sm font-data">#{order.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip
                    status={getStatusType(order.status)}
                    label={order.status?.toUpperCase()}
                  />
                  {order.invoice_url && (
                    <a
                      href={api.mediaUrl(order.invoice_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline font-semibold"
                    >
                      <Download size={14} />
                      Invoice
                    </a>
                  )}
                </div>
              </div>

              {/* Status tracker */}
              <div className="px-4 border-b border-border bg-muted/10">
                <OrderStatusTracker status={order.status} />
              </div>

              {/* Items */}
              <div className="p-6">
                <div className="space-y-4">
                  {order.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden border border-border/30">
                        {item.product?.media?.[0]?.media_url ? (
                          <img
                            src={api.mediaUrl(
                              item.product.media[0].media_url
                            )}
                            alt={item.product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Img
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Link
                          href={`/marketplace/${item.product_id}`}
                          className="font-bold hover:text-primary transition-colors inline-flex items-center gap-1 font-display"
                        >
                          {item.product?.title ||
                            `Product #${item.product_id}`}
                          <ExternalLink size={12} className="opacity-50" />
                        </Link>
                        {item.selected_config &&
                          Object.keys(item.selected_config).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 font-data">
                              {JSON.stringify(item.selected_config)}
                            </p>
                          )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold font-data text-foreground">
                          ${item.price_at_purchase?.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground font-data mt-0.5">
                          Qty: {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <MarketplaceShell>
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-10 w-48" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </MarketplaceShell>
  );
}
