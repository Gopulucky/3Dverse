"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Trash2, ShoppingCart, ArrowRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const { setItemCount } = useCartStore();
  const [couponCode, setCouponCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [couponError, setCouponError] = useState("");

  const {
    data: cart,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<any>("/api/cart/"),
    enabled: isAuthenticated,
  });


  if (!isAuthenticated) return null;

  const updateQuantity = async (itemId: number, newQty: number) => {
    try {
      await api.put(`/api/cart/items/${itemId}`, { quantity: newQty });
      refetch();
    } catch {
      toast.error("Failed to update quantity");
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await api.delete(`/api/cart/items/${itemId}`);
      toast.success("Item removed");
      const result = await refetch();
      setItemCount(result.data?.items?.length || 0);
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const applyCoupon = async () => {
    setCouponError("");
    setDiscountInfo(null);
    try {
      const result = await api.post<any>("/api/cart/apply-coupon", {
        code: couponCode,
      });
      setDiscountInfo(result);
      toast.success("Coupon applied!");
    } catch (e: any) {
      setCouponError(e.detail || "Invalid coupon");
      toast.error("Invalid coupon code");
    }
  };

  const subtotal =
    cart?.items?.reduce(
      (acc: number, item: any) => acc + item.product.price * item.quantity,
      0
    ) || 0;

  let discountAmount = 0;
  if (discountInfo) {
    if (discountInfo.percent_off) {
      discountAmount = subtotal * (discountInfo.percent_off / 100);
    } else if (discountInfo.flat_off) {
      discountAmount = discountInfo.flat_off;
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    if (discountInfo) {
      sessionStorage.setItem("coupon", discountInfo.code);
    } else {
      sessionStorage.removeItem("coupon");
    }
    router.push("/checkout");
  };

  const content = (
    <div className="max-w-5xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <ShoppingCart className="text-primary" />
        Your Cart
      </h1>

      {!cart || !cart.items || cart.items.length === 0 ? (
        <Card className="p-12 text-center border-border bg-card">
          <p className="text-muted-foreground mb-6 font-display">Your cart is empty.</p>
          <Button asChild>
            <Link href="/marketplace">Browse Marketplace</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            {cart.items.map((item: any) => {
              const img =
                item.product?.media?.find((m: any) => m.is_primary)
                  ?.media_url || item.product?.media?.[0]?.media_url;

              return (
                <Card
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-border bg-card shadow-sm"
                >
                  <div className="w-20 h-20 rounded-lg bg-muted shrink-0 overflow-hidden">
                    {img ? (
                      <img
                        src={api.mediaUrl(img)}
                        alt={item.product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate font-display">
                      {item.product.title}
                    </h3>
                    <p className="text-sm text-muted-foreground font-data mt-0.5">
                      ${item.product.price?.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                    <div className="flex items-center rounded-md border border-border bg-background">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="px-2.5 py-1 hover:bg-accent transition-colors rounded-l-md"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="px-3 py-1 border-x border-border text-sm font-medium font-data">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="px-2.5 py-1 hover:bg-accent transition-colors rounded-r-md"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <p className="font-bold w-20 text-right font-data text-foreground">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </p>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Order Summary */}
          <Card className="p-6 h-fit sticky top-24 border-border bg-card shadow-sm">
            <h3 className="font-bold text-xl mb-6 font-display">Order Summary</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-muted-foreground font-data text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-success font-data text-sm">
                  <span>Discount ({discountInfo.code})</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold font-data text-foreground">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Coupon */}
            <div className="mb-6 space-y-2">
              <label className="text-sm text-muted-foreground font-medium">
                Have a coupon code?
              </label>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Code"
                  className="uppercase"
                />
                <Button variant="outline" onClick={applyCoupon}>
                  Apply
                </Button>
              </div>
              {couponError && (
                <p className="text-destructive text-xs">{couponError}</p>
              )}
            </div>

            <Button
              onClick={handleCheckout}
              className="w-full"
              size="lg"
            >
              Proceed to Checkout
              <ArrowRight size={18} />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <MarketplaceShell>
      {isLoading ? (
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 space-y-4">
          <Skeleton className="h-10 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </MarketplaceShell>
  );
}
