"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import { purchasePrice, type ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { useRequireAuth, useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey && /^pk_(test|live)_/.test(publishableKey) && !publishableKey.includes("fake")
  ? loadStripe(publishableKey) : null;

type Address = { name: string; street: string; city: string; state: string; zip: string; country: string; phone: string };
type Attempt = { idempotency_key: string; shipping_method: "standard"; shipping_address: Address | null; coupon_code: string | null };
type Checkout = { order_id: number; client_secret: string; total: number; subtotal: number; shipping_cost: number; currency: string; payment_status: string;
  shipping_address: Address | null; items: { title: string; purchase_type: string; quantity: number; unit_price: number }[] };
type Cart = { items: { id: number; quantity: number; selected_config?: { purchase_type?: string }; product: ProductCardData }[] };
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
  const stripe = useStripe();
  const elements = useElements();
  const attempted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await stripe.confirmPayment({
        elements, confirmParams: { return_url: `${window.location.origin}/orders` }, redirect: "if_required",
      });
      if (result.error) {
        setMessage(result.error.message || "Payment could not be completed. Check your details and try again.");
        attempted.current = false;
        return;
      }
      setFinished(true);
      setMessage("Payment submitted. Waiting for secure confirmation for your saved order.");
      for (let check = 0; check < 8; check++) {
        const order = await api.get<{ payment_verified_at: string | null }>(`/api/orders/${checkout.order_id}`);
        if (order.payment_verified_at) {
          sessionStorage.removeItem(storageKey);
          sessionStorage.removeItem("coupon");
          setMessage("Payment confirmed. Your order is ready to view.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setMessage("Your order is saved and payment confirmation is pending. Check Orders for updates before trying another payment.");
    } catch {
      setFinished(true);
      setMessage("We could not confirm the latest payment status. Your order is saved. Check Orders before trying another payment.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    {!finished && <PaymentElement />}
    {message && <p role="status" className="text-sm rounded-lg bg-muted p-4">{message}</p>}
    {!finished && <Button type="submit" disabled={!stripe || !elements || busy} className="w-full" size="lg">
      {busy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
      {busy ? "Confirming payment..." : `Pay ${formatMoney(checkout.total, checkout.currency)}`}
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
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const items = data?.cart.items || [];
  const hasPhysical = items.some((item) => item.selected_config?.purchase_type === "physical" ||
    (!item.selected_config?.purchase_type && item.product.is_mode_3_active));
  const invalidCart = items.some((item) => item.product.currency !== "INR" ||
    purchasePrice(item.product, item.selected_config?.purchase_type) == null);
  const savedAttempt = frozenAttempt || data?.saved;
  const resuming = !!(savedAttempt || data?.orderId);

  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (preparing.current || !stripePromise) return;
    preparing.current = true;
    setBusy(true);
    setError("");
    try {
      if (data?.orderId) {
        setCheckout(await api.post<Checkout>(`/api/checkout/orders/${data.orderId}/resume`));
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
      setCheckout(response);
      setItemCount(0);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 400 || failure.status === 422 ||
          (failure.status === 409 && failure.message.includes("completed or cancelled")))) {
        sessionStorage.removeItem(storageKey);
        setFrozenAttempt(null);
        void refetch();
      }
      setError(failure instanceof Error ? failure.message : "Checkout could not be prepared. Please try again.");
    } finally {
      preparing.current = false;
      setBusy(false);
    }
  }

  return <MarketplaceShell><main className="mx-auto max-w-4xl px-6 pb-20 pt-24">
    <Link href="/cart" className="inline-flex min-h-11 items-center underline text-sm">Back to cart</Link>
    <h1 className="font-display text-3xl font-semibold mb-3">Checkout</h1>
    <p className="text-muted-foreground mb-8">Review your delivery details, then confirm your payment. Downloads unlock after payment is verified.</p>
    {!ready || isPending ? <p role="status">Loading your checkout...</p> : isError ?
      <Card className="p-6 space-y-3"><p role="alert">We could not load your cart.</p><Button onClick={() => void refetch()}>Try again</Button></Card> :
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold">{checkout ? `Order #${checkout.order_id}` : "1. Review your order"}</h2>
          {(!resuming && !checkout ? items : []).map((item) => <div key={item.id} className="border-b pb-3">
            <p className="font-medium">{item.product.title}</p>
            <p className="text-sm text-muted-foreground">{item.selected_config?.purchase_type === "physical" ? "Printed product" : item.selected_config?.purchase_type === "digital" ? "Digital download" : "Selected option"} ? Quantity {item.quantity}</p>
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
          {!stripePromise ? <p role="status">Payments are not available right now. You can keep browsing and return later.</p> : checkout && ["succeeded", "processing", "requires_capture"].includes(checkout.payment_status) ?
            <div className="space-y-4"><p role="status">Payment has already been submitted. Your saved order is waiting for secure confirmation.</p><Link href="/orders" className="inline-flex min-h-11 items-center underline">View orders</Link></div> : checkout ?
            <Elements stripe={stripePromise} options={{ clientSecret: checkout.client_secret, appearance: { theme: "stripe" } }}>
              <PaymentForm checkout={checkout} storageKey={storageKey} />
            </Elements> :
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
