"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, ShoppingCart, Tag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { productImage, productThumb } from "@/lib/marketplace";
import { ThumbImage } from "@/components/shared/thumb-image";
import { formatMoney } from "@/lib/currency";
import { MAX_QUANTITY, summarizeCart, unitPrice, withQuantity, type CartLine, type Discount } from "@/lib/cart-summary";
import { CART_KEY, useCart, type Cart } from "@/lib/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

const ISSUE_TEXT = {
  mixed_currency: "Your cart has items in different currencies. Remove the older USD items to check out in INR.",
  non_inr: "These older USD listings need the creator to set an INR price before you can check out.",
  needs_format: "Some items have no format chosen. Remove them and pick a format on the product page.",
} as const;

function formatLabel(line: CartLine) {
  const type = line.selected_config?.purchase_type;
  if (type === "digital") return "Digital file · instant download";
  if (type === "physical") return "Physical print · delivered to you";
  return "Format needed · choose it on the product page";
}

function CartSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready } = useRequireAuth();
  const { data: cart, isPending, isError, refetch } = useCart(ready);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);
  const inFlight = useRef(0);

  const lines = cart?.items ?? [];
  const summary = summarizeCart(lines, discount);
  const money = (amount: number | null) => (amount == null ? "—" : formatMoney(amount, summary.currency));

  /** Update the screen at once, then tell the server. The server's answer only replaces the screen
   *  when no other change is still on its way, so quick taps never flicker back. */
  async function change(id: number, quantity: number, request: () => Promise<Cart>, failure: string) {
    const before = queryClient.getQueryData<Cart>(CART_KEY);
    if (!before) return;
    queryClient.setQueryData<Cart>(CART_KEY, { ...before, items: withQuantity(before.items, id, quantity) });
    inFlight.current += 1;
    try {
      const fresh = await request();
      if (inFlight.current === 1) queryClient.setQueryData(CART_KEY, fresh);
    } catch {
      toast.error(failure);
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    } finally {
      inFlight.current -= 1;
    }
  }

  const setQuantity = (line: CartLine, quantity: number) =>
    change(line.id, quantity, () => api.put<Cart>(`/api/cart/items/${line.id}`, { quantity }), "Could not update the quantity");

  const remove = (line: CartLine) =>
    change(line.id, 0, async () => {
      const fresh = await api.delete<Cart>(`/api/cart/items/${line.id}`);
      toast.success("Item removed");
      return fresh;
    }, "Could not remove the item");

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setApplying(true);
    setCouponError("");
    setDiscount(null);
    try {
      setDiscount(await api.post<Discount>("/api/cart/apply-coupon", { code }));
      toast.success("Coupon applied");
    } catch (e) {
      setCouponError((e as { detail?: string }).detail || "This coupon is not valid");
    } finally {
      setApplying(false);
    }
  }

  function checkout() {
    if (!summary.canCheckout) return;
    if (discount) sessionStorage.setItem("coupon", discount.code);
    else sessionStorage.removeItem("coupon");
    router.push("/checkout");
  }

  const checkoutButton = (
    <Button onClick={checkout} disabled={!summary.canCheckout} size="lg" className="w-full min-h-12">
      Checkout <ArrowRight size={18} aria-hidden="true" />
    </Button>
  );

  let body;
  if (!ready || isPending) {
    body = <CartSkeleton />;
  } else if (isError) {
    body = (
      <div role="alert" className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="mb-4 font-display text-lg font-semibold">We could not load your cart.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  } else if (lines.length === 0) {
    body = (
      <div data-flow="cart" data-state="empty" className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <ShoppingCart size={48} className="mb-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="mb-2 font-display text-2xl font-semibold">Your cart is empty</h2>
        <p className="mb-6 text-muted-foreground">Pick printed products delivered to you, or digital models for your own printer.</p>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-12 flex-1"><Link href="/marketplace?format=physical">Printed products</Link></Button>
          <Button asChild size="lg" variant="outline" className="min-h-12 flex-1"><Link href="/marketplace?format=digital">Digital models</Link></Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div data-flow="cart" data-state={summary.canCheckout ? "ready" : "blocked"} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {lines.map((line) => {
            const price = unitPrice(line);
            return (
              <li key={line.id} data-line={line.id} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link href={`/marketplace/${line.product.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28" aria-label={line.product.title}>
                  <ThumbImage thumb={productThumb(line.product)} original={productImage(line.product)} alt="" width={112} height={112} className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/marketplace/${line.product.id}`} className="line-clamp-2 font-display font-semibold hover:underline">{line.product.title}</Link>
                  <p className={price == null ? "mt-0.5 text-sm text-warning-ink" : "mt-0.5 text-sm text-muted-foreground"}>{formatLabel(line)}</p>
                  <p className="mt-1 font-data text-lg font-semibold">
                    {price == null ? "Price unavailable" : formatMoney(price * line.quantity, line.product.currency)}
                    {price != null && line.quantity > 1 && <span className="ml-2 text-sm font-normal text-muted-foreground">{formatMoney(price, line.product.currency)} each</span>}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
                    <div className="inline-flex items-center rounded-full border border-border" role="group" aria-label={`Quantity for ${line.product.title}`}>
                      <button type="button" aria-label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => setQuantity(line, line.quantity - 1)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"><Minus size={16} aria-hidden="true" /></button>
                      <span className="min-w-8 text-center font-data text-sm font-medium" aria-live="polite">{line.quantity}</span>
                      <button type="button" aria-label="Increase quantity" disabled={line.quantity >= MAX_QUANTITY} onClick={() => setQuantity(line, line.quantity + 1)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"><Plus size={16} aria-hidden="true" /></button>
                    </div>
                    <button type="button" onClick={() => remove(line)} className="min-h-11 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-destructive" aria-label={`Remove ${line.product.title}`}>Remove</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside aria-label="Price details" className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-display text-lg font-semibold">Price details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt>Price ({summary.itemCount} {summary.itemCount === 1 ? "item" : "items"})</dt><dd className="font-data">{money(summary.subtotal)}</dd></div>
            {summary.discount > 0 && discount && <div className="flex justify-between text-success-ink"><dt>Coupon {discount.code}</dt><dd className="font-data">−{money(summary.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd className="text-muted-foreground">Calculated at checkout</dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-data" data-total>{money(summary.total)}</dd></div>
          </dl>

          <div className="mt-4 border-t border-border pt-4">
            {couponOpen ? (
              <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void applyCoupon(); }}>
                <label htmlFor="coupon" className="text-sm font-medium">Coupon code</label>
                <div className="flex gap-2">
                  <Input id="coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} className="min-h-11 uppercase" autoComplete="off" />
                  <Button type="submit" variant="outline" className="min-h-11" disabled={applying || !couponCode.trim()}>{applying ? "Applying…" : "Apply"}</Button>
                </div>
                {couponError && <p role="alert" className="text-sm text-destructive">{couponError}</p>}
              </form>
            ) : (
              <button type="button" onClick={() => setCouponOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"><Tag size={16} aria-hidden="true" />Have a coupon?</button>
            )}
          </div>

          {summary.issue && <p role="status" className="mt-4 rounded-lg bg-warning-surface p-3 text-sm text-warning-ink">{ISSUE_TEXT[summary.issue]}</p>}
          <div className="mt-4 hidden lg:block">{checkoutButton}</div>
        </aside>
      </div>
    );
  }

  const showBar = ready && !isPending && !isError && lines.length > 0;

  return (
    <MarketplaceShell>
      <div className={`mx-auto max-w-6xl px-4 pt-6 sm:px-6 ${showBar ? "pb-32 lg:pb-16" : "pb-16"}`}>
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Cart{showBar && <span className="ml-2 text-lg font-normal text-muted-foreground">({lines.length})</span>}
          </h1>
          {showBar && <Link href="/marketplace" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Continue shopping</Link>}
        </div>
        {body}
      </div>

      {showBar && (
        <div data-flow="cart-checkout-bar" className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] lg:hidden">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-data text-lg font-semibold leading-tight">{money(summary.total)}</p>
          </div>
          <div className="flex-1">{checkoutButton}</div>
        </div>
      )}
    </MarketplaceShell>
  );
}
