"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { api, ApiError, API_URL } from "@/lib/api";
import { BRAND_COLORS } from "@/lib/brand";
import { formatMoney } from "@/lib/currency";
import { loadRazorpay, type RazorpaySuccess } from "@/lib/razorpay";
import { checkoutTimeout, formatCountdown, holdSecondsLeft, upiFirstDisplay, usesRedirectFlow } from "@/lib/machines/payment-options";
import { CART_KEY } from "@/lib/use-cart";
import { HOLD_KEY } from "@/components/marketplace/hold-banner";
import { purchasePrice, type ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { useRequireAuth, useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import {
  SUBMITTED_PAYMENT_STATUSES, checkoutReducer, checkoutViewState, initialCheckoutState, initialPaymentState, paymentFinished, paymentMessage, paymentReducer,
  type CheckoutEvent, type CheckoutState,
} from "@/lib/machines/checkout";

type Address = { name: string; street: string; city: string; state: string; zip: string; country: string; phone: string };
type Attempt = { idempotency_key: string; shipping_method: "standard"; shipping_address: Address | null; coupon_code: string | null };
type Checkout = { order_id: number; key_id: string; razorpay_order_id: string; amount_minor: number; hold_expires_at: string; total: number; subtotal: number; shipping_cost: number; currency: string; payment_status: string;
  shipping_address: Address | null; items: { title: string; purchase_type: string; quantity: number; unit_price: number }[] };
type Cart = { items: { id: number; quantity: number; selected_config?: { purchase_type?: string }; product: ProductCardData }[] };
const reduceCheckout = (state: CheckoutState<Checkout>, event: CheckoutEvent<Checkout>) => checkoutReducer(state, event);
const emptyAddress: Address = { name: "", street: "", city: "", state: "", zip: "", country: "IN", phone: "" };
const addressFields: { key: keyof Address; label: string; autoComplete: string; pattern?: string }[] = [
  { key: "name", label: "Full name", autoComplete: "shipping name" },
  { key: "phone", label: "Indian mobile number", autoComplete: "shipping tel", pattern: "(?:\\+91)?[6-9][0-9]{9}" },
  { key: "street", label: "House, street and area", autoComplete: "shipping street-address" },
  { key: "city", label: "City", autoComplete: "shipping address-level2" },
  { key: "state", label: "State or union territory", autoComplete: "shipping address-level1" },
  { key: "zip", label: "PIN code", autoComplete: "shipping postal-code", pattern: "[1-9][0-9]{5}" },
];

function PaymentForm({ checkout, storageKey }: { checkout: Checkout; storageKey: string }) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const secondsLeft = holdSecondsLeft(checkout.hold_expires_at, now);
  const attempted = useRef(false);
  const paidInWindow = useRef(false); // Checkout.js reported success: a later "dismiss" is not a cancellation
  const lastFailure = useRef("");
  const [pay, dispatchPay] = useReducer(paymentReducer, initialPaymentState);
  const busy = pay.status === "confirming";
  const finished = paymentFinished(pay);
  const message = paymentMessage(pay);

  function reopenable(error: string) {
    attempted.current = false;
    dispatchPay({ type: "PROVIDER_ERROR", error });
  }

  // Checkout.js only tells us the browser's side of the story. Ask our API, which
  // checks the signature and Razorpay itself; the signed webhook is the backstop.
  async function confirm(response: RazorpaySuccess) {
    paidInWindow.current = true;
    dispatchPay({ type: "SUBMITTED" });
    const done = () => {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem("coupon");
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
      void queryClient.invalidateQueries({ queryKey: HOLD_KEY });
      dispatchPay({ type: "VERIFIED" });
    };
    try {
      try {
        const verified = await api.post<{ status: "paid" | "pending" }>("/api/checkout/verify", { order_id: checkout.order_id, ...response });
        if (verified.status === "paid") return done();
      } catch { /* fall through: the webhook may still confirm this payment */ }
      for (let check = 0; check < 8; check++) {
        const order = await api.get<{ payment_verified_at: string | null }>(`/api/orders/${checkout.order_id}`);
        if (order.payment_verified_at) return done();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      dispatchPay({ type: "TIMED_OUT" });
    } catch {
      dispatchPay({ type: "FAILED" });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (attempted.current) return;
    attempted.current = true;
    paidInWindow.current = false;
    lastFailure.current = "";
    dispatchPay({ type: "CONFIRM" });
    const timeout = checkoutTimeout(holdSecondsLeft(checkout.hold_expires_at, Date.now()));
    if (!timeout) return reopenable("Your items are no longer held for this checkout. If you already paid, it will show in Orders; otherwise start again from your cart.");
    if (!(await loadRazorpay()) || !window.Razorpay) {
      return reopenable("The secure payment window could not be loaded. Check your connection and try again.");
    }
    const razorpay = new window.Razorpay({
      key: checkout.key_id, order_id: checkout.razorpay_order_id, amount: checkout.amount_minor, currency: checkout.currency,
      name: "3DVerse", description: `Order #${checkout.order_id}`,
      prefill: { name: checkout.shipping_address?.name || user?.full_name, email: user?.email, contact: checkout.shipping_address?.phone },
      theme: { color: BRAND_COLORS.violet.hex },
      config: { display: upiFirstDisplay() },
      timeout,
      // On a phone the customer may leave for a UPI app and the page's script may never run again:
      // have Razorpay post the signed result to our server, which verifies it and brings them back.
      ...(usesRedirectFlow(navigator.userAgent) ? { redirect: true, callback_url: `${API_URL}/api/checkout/callback` } : {}),
      modal: {
        // Wait a beat: if the window closes because payment succeeded, the success
        // handler may run just after this and must not be mistaken for a cancellation.
        ondismiss: () => setTimeout(() => {
          if (paidInWindow.current) return;
          reopenable(lastFailure.current
            ? `${lastFailure.current} You can try again.`
            : "The payment window was closed before payment finished. You can try again; if you were charged, it will show in Orders.");
        }, 400),
      },
      handler: (response) => { void confirm(response); },
    });
    // A failed try leaves Razorpay's window open so the customer can pick another method.
    // Remember why, and only report it if they then close the window.
    razorpay.on("payment.failed", (failure) => {
      lastFailure.current = failure.error?.description || "That payment did not go through.";
    });
    razorpay.open();
  }

  return <form onSubmit={submit} className="space-y-5" data-flow="payment" data-state={pay.status}>
    {!finished && (secondsLeft > 0
      ? <p className="text-sm text-muted-foreground" data-hold-countdown>Your items are held for <span className="font-data font-semibold">{formatCountdown(secondsLeft)}</span>. Pay with any UPI app, card or netbanking in Razorpay&apos;s secure window; your payment details are never entered on this site.</p>
      : <p role="status" className="text-sm rounded-lg bg-muted p-4">Your items are no longer held for this checkout. If you already paid, it will show in Orders; otherwise <Link href="/cart" className="underline">go back to your cart</Link> and start again.</p>)}
    {message && <p role="status" className="text-sm rounded-lg bg-muted p-4">{message}</p>}
    {!finished && secondsLeft > 0 && <Button type="submit" disabled={busy} className="w-full" size="lg">
      {busy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
      {busy ? "Waiting for payment..." : `Pay ${formatMoney(checkout.total, checkout.currency)}`}
    </Button>}
    <Link href="/orders" className="inline-flex min-h-11 items-center underline">View orders</Link>
  </form>;
}

export default function CheckoutPage() {
  const { ready } = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const setItemCount = useCartStore((state) => state.setItemCount);
  const storageKey = `checkout-attempt-${user?.id}`;
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [flow, dispatch] = useReducer(reduceCheckout, initialCheckoutState as CheckoutState<Checkout>);
  const checkout = flow.status === "payment" ? flow.checkout : null;
  const busy = flow.status === "preparing";
  const error = flow.status === "editing" ? flow.error : "";
  const preparing = useRef(false);
  const [frozenAttempt, setFrozenAttempt] = useState<Attempt | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["checkout-cart", user?.id], enabled: ready && !!user,
    queryFn: async () => {
      const cart = await api.get<Cart>("/api/cart/");
      const orderId = new URLSearchParams(window.location.search).get("order_id");
      let saved: Attempt | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { /* no saved attempt */ }
      return { cart, saved, orderId: orderId && /^[1-9][0-9]*$/.test(orderId) ? orderId : null };
    },
  });
  // Whether the API has Razorpay configured for this environment (no secrets involved).
  const availability = useQuery({
    queryKey: ["checkout-status"], enabled: ready && !!user, staleTime: 60_000,
    queryFn: () => api.get<{ available: boolean }>("/api/checkout/status"),
  });
  const paymentsAvailable = availability.data?.available === true;
  const items = data?.cart.items || [];
  const hasPhysical = items.some((item) => item.selected_config?.purchase_type === "physical" ||
    (!item.selected_config?.purchase_type && item.product.is_mode_3_active));
  const invalidCart = items.some((item) => item.product.currency !== "INR" ||
    purchasePrice(item.product, item.selected_config?.purchase_type) == null);
  const savedAttempt = frozenAttempt || data?.saved;
  const resuming = !!(savedAttempt || data?.orderId);

  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (preparing.current || !paymentsAvailable) return;
    preparing.current = true;
    dispatch({ type: "PREPARE" });
    try {
      if (data?.orderId) {
        dispatch({ type: "PREPARED", checkout: await api.post<Checkout>(`/api/checkout/orders/${data.orderId}/resume`) });
        return;
      }
      const attempt: Attempt = savedAttempt || {
        idempotency_key: crypto.randomUUID(), shipping_method: "standard",
        shipping_address: hasPhysical ? address : null, coupon_code: sessionStorage.getItem("coupon"),
      };
      // Freeze both details and key before the request: a timeout can occur
      // after the server has already saved this order.
      setFrozenAttempt(attempt);
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      const response = await api.post<Checkout>("/api/checkout/create-payment-intent", attempt);
      dispatch({ type: "PREPARED", checkout: response });
      setItemCount(0);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 400 || failure.status === 422 ||
          (failure.status === 409 && failure.message.includes("completed or cancelled")))) {
        sessionStorage.removeItem(storageKey);
        setFrozenAttempt(null);
        void refetch();
      }
      dispatch({ type: "PREPARE_FAILED", error: failure instanceof Error ? failure.message : "Checkout could not be prepared. Please try again." });
    } finally {
      preparing.current = false;
    }
  }

  return <MarketplaceShell><main className="mx-auto max-w-4xl px-6 pb-20 pt-24" data-flow="checkout"
    data-state={checkoutViewState({ ready, isPending: isPending || availability.isPending, isError, paymentsAvailable, state: flow })}>
    <Link href="/cart" className="inline-flex min-h-11 items-center underline text-sm">Back to cart</Link>
    <h1 className="font-display text-3xl font-semibold mb-3">Checkout</h1>
    <p className="text-muted-foreground mb-8">Review your delivery details, then confirm your payment. Downloads unlock after payment is verified.</p>
    {!ready || isPending || availability.isPending ? <p role="status">Loading your checkout...</p> : isError ?
      <Card className="p-6 space-y-3"><p role="alert">We could not load your cart.</p><Button onClick={() => void refetch()}>Try again</Button></Card> :
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold">{checkout ? `Order #${checkout.order_id}` : "1. Review your order"}</h2>
          {(!resuming && !checkout ? items : []).map((item) => <div key={item.id} className="border-b pb-3">
            <p className="font-medium">{item.product.title}</p>
            <p className="text-sm text-muted-foreground">{item.selected_config?.purchase_type === "physical" ? "Printed product" : item.selected_config?.purchase_type === "digital" ? "Digital download" : "Selected option"} · Quantity {item.quantity}</p>
            <p className="font-data">{formatMoney((purchasePrice(item.product, item.selected_config?.purchase_type) ?? item.product.price ?? 0) * item.quantity, item.product.currency)}</p>
          </div>)}
          {checkout?.items.map((item, index) => <div key={index} className="border-b pb-3">
            <p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.purchase_type === "physical" ? "Printed product" : "Digital download"} · Quantity {item.quantity}</p>
            <p className="font-data">{formatMoney(item.unit_price * item.quantity, checkout.currency)}</p>
          </div>)}
          {checkout?.shipping_address && <p className="text-sm">Deliver to {checkout.shipping_address.name}, {checkout.shipping_address.street}, {checkout.shipping_address.city}, {checkout.shipping_address.state} {checkout.shipping_address.zip}, India.</p>}
          {checkout ? <><p>Your order details are saved. Payment is confirmed securely by the payment provider.</p>
            <dl className="space-y-3 text-sm"><div className="flex justify-between"><dt>Items</dt><dd>{formatMoney(checkout.subtotal, checkout.currency)}</dd></div>
              {checkout.subtotal + checkout.shipping_cost > checkout.total && <div className="flex justify-between"><dt>Discount</dt><dd>{formatMoney(checkout.subtotal + checkout.shipping_cost - checkout.total, checkout.currency)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(checkout.shipping_cost, checkout.currency)}</dd></div>
              <div className="flex justify-between font-semibold text-base"><dt>Total to pay</dt><dd>{formatMoney(checkout.total, checkout.currency)}</dd></div></dl></> :
            <p className="text-sm text-muted-foreground">{resuming ? "Your saved order summary will appear when you resume checkout." : hasPhysical ? "Delivery within India. The final shipping charge is shown before payment. Delivery timing depends on production and carrier availability." : "Digital files only: no shipping or delivery address required."}</p>}
        </Card>
        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold">{checkout ? "2. Secure payment" : resuming ? "Continue your saved checkout" : hasPhysical ? "Delivery details" : "Ready to continue"}</h2>
          {!paymentsAvailable ? <p role="status">Payments are not available right now. You can keep browsing and return later.</p> : checkout && SUBMITTED_PAYMENT_STATUSES.includes(checkout.payment_status) ?
            <div className="space-y-4"><p role="status">Payment has already been submitted. Your saved order is waiting for secure confirmation.</p><Link href="/orders" className="inline-flex min-h-11 items-center underline">View orders</Link></div> : checkout ?
            <PaymentForm checkout={checkout} storageKey={storageKey} /> :
            <form onSubmit={prepare} className="space-y-4">
              {resuming ? <p className="text-sm">Continue using the same saved order details. If payment was already submitted, check Orders for its status.</p> : hasPhysical &&
                <fieldset disabled={busy} className="space-y-4"><legend className="text-sm mb-4">Country: India</legend>
                  {addressFields.map((field) => <div key={field.key}><Label htmlFor={`checkout-${field.key}`}>{field.label}</Label>
                    <Input id={`checkout-${field.key}`} className="mt-2" required maxLength={200} autoComplete={field.autoComplete} pattern={field.pattern}
                      value={address[field.key]} onChange={(event) => setAddress({ ...address, [field.key]: event.target.value })} />
                  </div>)}
                </fieldset>}
              {invalidCart && !resuming && <p role="alert">Choose an available purchase option for each item. Legacy USD listings need to be repriced before INR checkout.</p>}
              {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={busy || (!resuming && (!items.length || invalidCart))}>
                {busy && <Loader2 className="animate-spin" size={18} />}{busy ? "Preparing your order..." : resuming ? "Resume secure checkout" : "Continue to payment"}
              </Button>
              <p className="text-xs text-muted-foreground">You will see the final total before confirming payment.</p>
              <Link href="/orders" className="inline-flex min-h-11 items-center underline text-sm">Check existing orders</Link>
            </form>}
        </Card>
      </div>}
  </main></MarketplaceShell>;
}
