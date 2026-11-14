"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { useRequireAuth } from "@/stores/auth-store";
import { PAYMENT_MESSAGES } from "@/lib/machines/checkout";
import { CART_KEY } from "@/lib/use-cart";
import { HOLD_KEY } from "@/components/marketplace/hold-banner";

const POLL_MS = 2000;
const MAX_POLLS = 20; // about 40 seconds: UPI approval can take a moment

type Progress = { orderId: string | null; paid: boolean };

/**
 * Where a phone browser lands after paying (Razorpay posts to our API, which verifies the
 * signature and redirects here). The server may still be waiting on Razorpay's own
 * confirmation, so this page asks the order until it is verified instead of assuming.
 */
export default function CheckoutReturnPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data, isError } = useQuery({
    queryKey: ["checkout-return"], enabled: ready, gcTime: 0,
    refetchInterval: (query) => (query.state.data?.paid || query.state.dataUpdateCount >= MAX_POLLS ? false : POLL_MS),
    queryFn: async (): Promise<Progress> => {
      const raw = new URLSearchParams(window.location.search).get("order_id");
      if (!raw || !/^[1-9][0-9]*$/.test(raw)) return { orderId: null, paid: false };
      const order = await api.get<{ payment_verified_at: string | null }>(`/api/orders/${raw}`);
      return { orderId: raw, paid: !!order.payment_verified_at };
    },
  });
  const paid = data?.paid === true;
  useEffect(() => {
    if (!paid) return;
    sessionStorage.removeItem("coupon");
    for (const key of [CART_KEY, HOLD_KEY, ["orders"]]) void queryClient.invalidateQueries({ queryKey: key });
  }, [paid, queryClient]);

  const orderId = data?.orderId ?? null;
  const settled = (queryClient.getQueryState(["checkout-return"])?.dataUpdateCount ?? 0) >= MAX_POLLS;
  const state = isError ? "unknown" : paid ? "confirmed" : !ready || !data ? "verifying" : !orderId ? "unknown" : settled ? "pending" : "verifying";

  return (
    <MarketplaceShell>
      <main data-flow="payment-return" data-state={state} className="mx-auto max-w-xl px-6 pb-20 pt-24">
        <h1 className="mb-3 font-display text-3xl font-semibold">
          {state === "confirmed" ? "Payment confirmed" : state === "verifying" ? "Confirming your payment" : "We are still checking your payment"}
        </h1>
        <p role="status" className="mb-6 flex items-start gap-3 rounded-lg bg-muted p-4 text-sm">
          {state === "verifying" && <Loader2 className="mt-0.5 shrink-0 animate-spin" size={16} aria-hidden="true" />}
          <span>{state === "verifying" ? "Waiting for your bank and Razorpay to confirm. Please keep this page open." : PAYMENT_MESSAGES[state]}</span>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {orderId && <Button asChild size="lg" className="min-h-12"><Link href={`/orders/${orderId}`}>View order</Link></Button>}
          <Button asChild size="lg" variant="outline" className="min-h-12"><Link href="/orders">Your orders</Link></Button>
        </div>
      </main>
    </MarketplaceShell>
  );
}
