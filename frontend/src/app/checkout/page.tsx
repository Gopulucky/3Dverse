"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock, Loader2, Truck, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_fake"
);

// Step indicator
const steps = ["Address", "Shipping", "Payment"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
              idx < current
                ? "bg-success-surface text-success-ink"
                : idx === current
                ? "bg-primary-surface text-primary-ink ring-2 ring-primary/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {idx < current && <CheckCircle2 size={12} />}
            {step}
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "w-8 h-px mx-1",
                idx < current ? "bg-moss" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CheckoutForm({ clientSecret, shippingMethod, address, couponCode }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { setItemCount } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError("");

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "An error occurred during payment.");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const res = await api.post("/api/orders/confirm", {
          shipping_address: address,
          coupon_code: couponCode,
        });
        sessionStorage.removeItem("coupon");
        setItemCount(0);
        toast.success("Order placed successfully!");
        router.push("/orders");
      } catch {
        setError(
          "Payment succeeded, but order creation failed. Please contact support."
        );
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full font-semibold"
        size="lg"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <>
            <Lock size={16} />
            Pay Now
          </>
        )}
      </Button>
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const { setItemCount } = useCartStore();
  const [clientSecret, setClientSecret] = useState("");
  const [total, setTotal] = useState(0);
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [address, setAddress] = useState({
    name: "",
    street: "",
    city: "",
    zip: "",
    country: "US",
  });

  const couponCode =
    typeof window !== "undefined" ? sessionStorage.getItem("coupon") : null;

  useEffect(() => {
    // useRequireAuth handles the login redirect once hydration completes.
    if (!isAuthenticated) return;
    initializeCheckout();
  }, [shippingMethod, isAuthenticated]);

  const initializeCheckout = async () => {
    try {
      const data = await api.post<any>(
        "/api/checkout/create-payment-intent",
        {
          shipping_method: shippingMethod,
          coupon_code: couponCode,
        }
      );
      setClientSecret(data.client_secret);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
  };

  // Determine active step
  const activeStep = clientSecret ? 2 : address.name ? 1 : 0;

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-6 font-display">Checkout</h1>

      <StepIndicator current={activeStep} />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Shipping Address */}
          <Card className="p-6 border-border bg-card shadow-sm">
            <h2 className="text-lg font-bold mb-4 font-display">Shipping Details</h2>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Full Name</Label>
                <Input
                  placeholder="Full Name"
                  value={address.name}
                  onChange={(e) =>
                    setAddress({ ...address, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="mb-2 block">Street Address</Label>
                <Input
                  placeholder="Street Address"
                  value={address.street}
                  onChange={(e) =>
                    setAddress({ ...address, street: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">City</Label>
                  <Input
                    placeholder="City"
                    value={address.city}
                    onChange={(e) =>
                      setAddress({ ...address, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-2 block">ZIP / Postal</Label>
                  <Input
                    placeholder="Zip / Postal"
                    value={address.zip}
                    mono
                    onChange={(e) =>
                      setAddress({ ...address, zip: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Shipping Method */}
          <Card className="p-6 border-border bg-card shadow-sm">
            <h2 className="text-lg font-bold mb-4 font-display">Shipping Method</h2>
            <div className="space-y-3">
              <label
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                  shippingMethod === "standard"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <input
                  type="radio"
                  name="shipping"
                  value="standard"
                  checked={shippingMethod === "standard"}
                  onChange={() => setShippingMethod("standard")}
                  className="accent-primary"
                />
                <Truck size={18} className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Standard Shipping</p>
                  <p className="text-xs text-muted-foreground font-data mt-0.5">
                    3-5 business days
                  </p>
                </div>
                <span className="font-bold font-data text-sm">$5.00</span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                  shippingMethod === "express"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <input
                  type="radio"
                  name="shipping"
                  value="express"
                  checked={shippingMethod === "express"}
                  onChange={() => setShippingMethod("express")}
                  className="accent-primary"
                />
                <Zap size={18} className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Express Shipping</p>
                  <p className="text-xs text-muted-foreground font-data mt-0.5">
                    1-2 business days
                  </p>
                </div>
                <span className="font-bold font-data text-sm">$15.00</span>
              </label>
            </div>
          </Card>
        </div>

        {/* Payment */}
        <Card className="p-6 h-fit sticky top-24 border-border bg-card shadow-sm">
          <h2 className="text-lg font-bold mb-4 font-display">Payment</h2>
          <p className="mb-6 font-semibold text-lg text-muted-foreground">
            Total:{" "}
            <span className="text-primary font-bold font-data">${total.toFixed(2)}</span>
          </p>

          <div className="bg-card p-4 rounded-lg text-foreground border border-border shadow-inner">
            {clientSecret === "mock_client_secret" ? (
              <div className="text-center py-6">
                <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
                  Test Mode: No Stripe keys provided. Click below to
                  simulate a successful payment.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      await api.post("/api/orders/confirm", {
                        shipping_address: address,
                        coupon_code: couponCode,
                      });
                      sessionStorage.removeItem("coupon");
                      setItemCount(0);
                      toast.success("Order placed successfully!");
                      router.push("/orders");
                    } catch {
                      toast.error("Mock payment failed");
                    }
                  }}
                  className="w-full font-semibold"
                  size="lg"
                >
                  Simulate Payment
                </Button>
              </div>
            ) : (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <CheckoutForm
                  clientSecret={clientSecret}
                  shippingMethod={shippingMethod}
                  address={address}
                  couponCode={couponCode}
                />
              </Elements>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <MarketplaceShell>
      {!clientSecret ? (
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        content
      )}
    </MarketplaceShell>
  );
}
