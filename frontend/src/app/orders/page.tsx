"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Download, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import { productImage, type ProductCardData } from "@/lib/marketplace";
import { DownloadModel } from "@/components/shared/download-model";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { useRequireAuth } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { orderPhase } from "@/lib/order-lifecycle";
import { ORDER_FILTERS, filterCounts, filterOrders, orderHeadline, type OrderFilter } from "@/lib/order-view";

interface OrderLine {
  id: number;
  product_id: number;
  quantity: number;
  price_at_purchase: number;
  selected_config?: { purchase_type?: string } | null;
  product?: (ProductCardData & { digital_download_enabled?: boolean }) | null;
}

interface CustomerOrder {
  id: number;
  status: string;
  created_at: string;
  total: number;
  currency: string;
  payment_verified_at?: string | null;
  invoice_url?: string | null;
  tracking_url?: string | null;
  items: OrderLine[];
}

const TONE_TO_CHIP = { success: "success", warning: "warning", "in-progress": "in-progress", neutral: "neutral" } as const;

function formatLabel(line: OrderLine) {
  const type = line.selected_config?.purchase_type;
  return type === "digital" ? "Digital file" : type === "physical" ? "Physical print" : "Earlier listing";
}

function OrderCard({ order }: { order: CustomerOrder }) {
  const headline = orderHeadline(order);
  const phase = orderPhase(order.status);
  return (
    <article data-order={order.id} data-flow="order-status" data-state={phase.kind} className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border bg-muted/40 px-4 py-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Placed</p><p className="font-data">{formatDate(order.created_at)}</p></div>
        <div><p className="text-xs text-muted-foreground">Total</p><p className="font-data font-semibold">{formatMoney(order.total || 0, order.currency)}</p></div>
        <div className="ml-auto text-right"><p className="text-xs text-muted-foreground">Order</p><p className="font-data"><span>#{order.id}</span></p></div>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusChip status={TONE_TO_CHIP[headline.tone]} label={headline.title} />
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{headline.detail}</p>
          {headline.progress && (
            <div className="mb-4">
              <div role="progressbar" aria-label="Order progress" aria-valuemin={1} aria-valuemax={headline.progress.of} aria-valuenow={headline.progress.step} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(headline.progress.step / headline.progress.of) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Step {headline.progress.step} of {headline.progress.of}</p>
            </div>
          )}

          <ul className="divide-y divide-border/60">
            {order.items?.map((item) => {
              const image = item.product ? productImage(item.product) : undefined;
              return (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={`/marketplace/${item.product_id}`} aria-label={item.product?.title || `Product ${item.product_id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={api.mediaUrl(image)} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/marketplace/${item.product_id}`} className="line-clamp-2 font-display font-semibold hover:underline">{item.product?.title || `Product #${item.product_id}`}</Link>
                    <p className="text-sm text-muted-foreground">{formatLabel(item)} · Qty {item.quantity}</p>
                    <DownloadModel order={order} item={item} />
                  </div>
                  <p className="shrink-0 font-data font-semibold">{formatMoney(item.price_at_purchase || 0, order.currency)}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:w-48 sm:shrink-0">
          {order.status === "pending_payment" && (
            <Button asChild size="lg" className="min-h-11"><Link href={`/checkout?order_id=${order.id}`}>Continue payment</Link></Button>
          )}
          {order.tracking_url && (
            <Button asChild variant="outline" className="min-h-11"><a href={order.tracking_url} target="_blank" rel="noopener noreferrer"><Truck size={16} aria-hidden="true" />Track package</a></Button>
          )}
          <Button asChild variant="outline" className="min-h-11"><Link href={`/orders/${order.id}`}>View details</Link></Button>
          {order.invoice_url && (
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => api.download(`/api/downloads/orders/${order.id}/invoice`, `invoice_${order.id}.pdf`).catch((e) => toast.error(e.message))}>
              <Download size={16} aria-hidden="true" />Invoice
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[1, 2].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
    </div>
  );
}

export default function OrdersPage() {
  const { ready } = useRequireAuth();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const { data: orders, isPending, isError, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<CustomerOrder[]>("/api/orders/"),
    enabled: ready,
  });

  const all = orders ?? [];
  const counts = filterCounts(all);
  const shown = filterOrders(all, filter);

  let body;
  if (!ready || isPending) {
    body = <OrdersSkeleton />;
  } else if (isError) {
    body = (
      <div role="alert" className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="mb-4 font-display text-lg font-semibold">We could not load your orders.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  } else if (all.length === 0) {
    body = (
      <div className="mx-auto max-w-md py-16 text-center">
        <Package size={48} className="mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="mb-2 font-display text-2xl font-semibold">No orders yet</h2>
        <p className="mb-6 text-muted-foreground">When you buy a model or a print, it will show up here.</p>
        <Button asChild size="lg" className="min-h-12"><Link href="/marketplace">Browse the marketplace</Link></Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0" role="group" aria-label="Filter orders">
          {ORDER_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                filter === option.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
              )}
            >
              {option.label} <span className="font-data opacity-80">{counts[option.id]}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No orders here.</p>
        ) : (
          <div className="space-y-4">{shown.map((order) => <OrderCard key={order.id} order={order} />)}</div>
        )}
      </>
    );
  }

  return (
    <MarketplaceShell>
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="mb-5 font-display text-2xl font-semibold sm:text-3xl">Your orders</h1>
        {body}
      </div>
    </MarketplaceShell>
  );
}
