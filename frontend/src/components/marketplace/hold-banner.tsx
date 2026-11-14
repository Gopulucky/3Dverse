"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import { formatCountdown, holdSecondsLeft } from "@/lib/machines/payment-options";

export const HOLD_KEY = ["checkout-hold"] as const;

type Hold = { order_id: number; hold_expires_at: string; total: number; currency: string };

/**
 * A started-but-unpaid checkout is not an order, so it is not listed with orders.
 * It shows here instead, with the time left before the items are released.
 */
export function HoldBanner({ enabled }: { enabled: boolean }) {
  const { data } = useQuery({
    queryKey: HOLD_KEY, enabled, refetchInterval: 60_000,
    queryFn: () => api.get<{ hold: Hold | null }>("/api/checkout/hold"),
  });
  const [now, setNow] = useState(() => Date.now());
  const hold = data?.hold ?? null;
  useEffect(() => {
    if (!hold) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [hold]);
  if (!hold) return null;
  const left = holdSecondsLeft(hold.hold_expires_at, now);
  if (left <= 0) return null;
  return (
    <div role="status" data-flow="hold-banner" data-order={hold.order_id}
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-warning-surface p-4 text-warning-ink">
      <p className="text-sm">
        Payment of <span className="font-data font-semibold">{formatMoney(hold.total, hold.currency)}</span> in progress.
        We are holding your items for <span className="font-data font-semibold" data-countdown>{formatCountdown(left)}</span>.
      </p>
      <Link href={`/checkout?order_id=${hold.order_id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Complete payment</Link>
    </div>
  );
}
