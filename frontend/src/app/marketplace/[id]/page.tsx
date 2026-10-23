"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Star,
  Heart,
  ShoppingCart,
  Loader2,
  ChevronRight,
  Download,
  Printer,
  Wand2,
  Ruler,
  Box,
  FileBox,
  ShieldCheck,
  BadgeCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

// three.js is several hundred KB. Load the viewer on demand (client only) so the
// product title, price and photos paint first instead of waiting on the 3D engine.
const Advanced3DViewer = dynamic(
  () => import("@/components/shared/advanced-3d-viewer").then((m) => m.Advanced3DViewer),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted" aria-label="Loading 3D viewer" />,
  }
);
// --- Review Schema ---
const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(3, "Review must be at least 3 characters"),
});

type ReviewForm = z.infer<typeof reviewSchema>;

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SpecRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground font-medium w-36 shrink-0">
        {label}
      </span>
      <span className="text-sm text-foreground flex-1">
        {value}
      </span>
    </div>
  );
}

// --- Main Page ---
export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { increment } = useCartStore();

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<any>(`/api/marketplace/products/${id}`),
    enabled: !!id,
  });

  const {
    data: reviews = [],
    isLoading: reviewsLoading,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => api.get<any[]>(`/api/reviews/${id}`),
    enabled: !!id,
  });

  const { data: similarProducts = [] } = useQuery({
    queryKey: ["similar", id],
    queryFn: () => api.get<any[]>(`/api/marketplace/products/${id}/similar`),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5, text: "" },
  });

  const watchRating = watch("rating");

  const submitReview = async (data: ReviewForm) => {
    if (!isAuthenticated) {
      toast.error("Please login to leave a review");
      return;
    }

    try {
      await api.post(`/api/reviews/${id}`, data);
      toast.success("Review submitted!");
      reset();
      refetchReviews();
    } catch {
      toast.error("Failed to submit review");
    }
  };

  const handleAddToWishlist = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to add to wishlist");
      return;
    }
    try {
      await api.post(`/api/wishlist/${id}`);
      toast.success("Added to wishlist!");
    } catch {
      toast.error("Failed to add to wishlist");
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to add to cart");
      return;
    }
    try {
      await api.post("/api/cart/items", {
        product_id: Number(id),
        quantity: 1,
        selected_config: {},
      });
      increment();
      toast.success("Added to cart!");
    } catch {
      toast.error("Failed to add to cart");
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to purchase");
      return;
    }
    try {
      await api.post("/api/cart/items", {
        product_id: Number(id),
        quantity: 1,
        selected_config: {},
      });
      increment();
      router.push("/checkout");
    } catch {
      toast.error("Failed to process Buy It Now");
    }
  };

  if (productLoading) {
    return (
      <MarketplaceShell>
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
          <div className="grid md:grid-cols-2 gap-12">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </MarketplaceShell>
    );
  }

  if (!product) {
    return (
      <MarketplaceShell>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground text-lg font-display">Product not found</p>
        </div>
      </MarketplaceShell>
    );
  }

  const latestVersion =
    product.versions && product.versions.length > 0
      ? product.versions[product.versions.length - 1]
      : null;
  // Public shoppers see the decimated preview mesh; the source file is only
  // reachable through the entitlement-checked download endpoint.
  const modelUrl = latestVersion?.preview_url
    ? api.mediaUrl(latestVersion.preview_url)
    : null;

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((acc: number, r: any) => acc + r.rating, 0) /
          reviews.length
        ).toFixed(1)
      : "New";

  return (
    <MarketplaceShell>
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 pt-4">
          <Link href="/marketplace" className="hover:text-foreground transition-colors">
            Marketplace
          </Link>
          <ChevronRight size={14} />
          <Link
            href={`/marketplace?category=${product.category}`}
            className="hover:text-foreground transition-colors"
          >
            {product.category}
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-semibold">{product.title}</span>
        </nav>

        {/* Layout: Three-column Amazon Style */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 mb-16 items-start">
          {/* Left Column: 3D Viewer & Media (40%) */}
          <div className="lg:col-span-5 space-y-4">
            {modelUrl ? (
              <div className="h-[450px] lg:h-[500px]">
                <Advanced3DViewer url={modelUrl} />
              </div>
            ) : (
              <div className="h-[450px] lg:h-[500px] rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                No 3D Model Available
              </div>
            )}

            {product.media && product.media.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {product.media.map((m: any) => (
                  <img
                    key={m.id}
                    src={api.mediaUrl(m.media_url)}
                    className="w-16 h-16 object-cover rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    alt="thumbnail"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Middle Column: Details (35%) */}
          <div className="lg:col-span-4 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-display leading-tight">
                {product.title}
              </h1>

              {product.creator_name && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">
                    by{" "}
                    <span className="font-semibold text-primary hover:underline cursor-pointer transition-colors">
                      {product.creator_name}
                    </span>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 text-sm text-ember font-semibold mb-4">
                <Star size={16} fill="currentColor" />
                {avgRating}
                <span className="text-muted-foreground ml-1 font-normal font-data hover:text-foreground cursor-pointer transition-colors">
                  ({reviews.length} ratings)
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">{product.category}</Badge>
                {product.is_mode_2_active && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Download size={12} className="text-primary" /> Digital
                  </Badge>
                )}
                {product.is_mode_3_active && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Printer size={12} className="text-moss" /> Physical
                  </Badge>
                )}
                {product.is_mode_4_active && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Wand2 size={12} className="text-ember" /> Custom
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg font-display mb-2">About this item</h3>
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-sm">
                {product.description}
              </p>
            </div>

            <Separator />

            {/* Specifications inline */}
            {(latestVersion || product.license_type) && (
              <div>
                <h3 className="font-bold text-lg font-display mb-4">
                  Product information
                </h3>
                <div className="space-y-1">
                  {latestVersion?.printability_report?.dimensions && (
                    <SpecRow
                      icon={Ruler}
                      label="Dimensions"
                      value={`${latestVersion.printability_report.dimensions.x?.toFixed(0)} × ${latestVersion.printability_report.dimensions.y?.toFixed(0)} × ${latestVersion.printability_report.dimensions.z?.toFixed(0)} mm`}
                    />
                  )}
                  {latestVersion?.printability_report?.volume_mm3 != null && (
                    <SpecRow
                      icon={Box}
                      label="Volume"
                      value={`${(latestVersion.printability_report.volume_mm3 / 1000).toFixed(1)} cm³`}
                    />
                  )}
                  {latestVersion?.file_name && (
                    <SpecRow
                      icon={FileBox}
                      label="File Format"
                      value={`${latestVersion.file_name.split(".").pop()?.toUpperCase()}${formatBytes(latestVersion.file_size) ? ` (${formatBytes(latestVersion.file_size)})` : ""}`}
                    />
                  )}
                  {latestVersion?.printability_report?.status && (
                    <SpecRow
                      icon={ShieldCheck}
                      label="Printability"
                      value={
                        <span
                          className={cn(
                            "capitalize font-medium",
                            latestVersion.printability_report.status === "pass"
                              ? "text-success"
                              : latestVersion.printability_report.status === "warning"
                              ? "text-warning"
                              : "text-muted-foreground"
                          )}
                        >
                          {latestVersion.printability_report.status}
                        </span>
                      }
                    />
                  )}
                  {product.license_type && (
                    <SpecRow
                      icon={BadgeCheck}
                      label="License"
                      value={product.license_type}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Buy Box (25%) */}
          <div className="lg:col-span-3">
            <div className="sticky top-24">
              <Card className="p-5 border-border bg-card shadow-lg flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-moss" />
                <p className="text-4xl font-bold text-foreground mb-6 font-data">
                  <span className="text-xl align-top text-muted-foreground mr-1">$</span>
                  {product.price?.toFixed(2)}
                </p>

                {/* Order Form */}
                <div className="space-y-6 mb-6">
                  {product.is_mode_3_active && (
                    <div className="space-y-4 pb-5 border-b border-border/50">
                      {product.available_materials?.length > 0 && (
                        <div>
                          <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Material</Label>
                          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                            {product.available_materials.map((m: string) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {product.available_colors?.length > 0 && (
                        <div>
                          <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Color</Label>
                          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                            {product.available_colors.map((c: string) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {product.available_sizes?.length > 0 && (
                        <div>
                          <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Size</Label>
                          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                            {product.available_sizes.map((s: string) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {product.is_mode_4_active &&
                    product.mode_4_config &&
                    Object.keys(product.mode_4_config).length > 0 && (
                      <div className="space-y-4 pb-5 border-b border-border/50">
                        {Object.entries(product.mode_4_config).map(
                          ([key, config]: [string, any]) => (
                            <div key={key}>
                              <Label className="mb-1.5 block capitalize text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {key.replace("_", " ")}
                              </Label>
                              <Input
                                placeholder={config.description || ""}
                                maxLength={config.maxLength}
                                className="h-9"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                </div>

                <div className="space-y-3 mb-5">
                  <Button
                    onClick={handleAddToCart}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm"
                    size="lg"
                  >
                    Add to Cart
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    className="w-full bg-ember hover:bg-ember/90 text-primary-foreground rounded-full shadow-sm transition-all duration-300"
                    size="lg"
                  >
                    Buy Now
                  </Button>
                </div>

                {/* Trust & Security Signals */}
                <div className="flex flex-col gap-2 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                  <div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="flex items-center gap-1 font-medium text-foreground"><ShieldCheck size={14} className="text-success" /> Secure transaction</span>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                    <span className="text-muted-foreground">Ships from</span>
                    <span className="font-medium text-foreground">3DVerse Partner</span>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                    <span className="text-muted-foreground">Sold by</span>
                    <span className="font-medium text-foreground text-primary hover:underline cursor-pointer">{product.creator_name || "Creator"}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                    <span className="text-muted-foreground">Returns</span>
                    <span className="font-medium text-foreground">Eligible for Return</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/50 flex justify-center">
                  <Button
                    onClick={handleAddToWishlist}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground w-full flex items-center justify-center gap-2"
                  >
                    <Heart size={16} /> Add to List
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Tabs: Reviews & Similar */}
        <Tabs defaultValue="reviews" className="mb-16">
          <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 space-x-6">
            <TabsTrigger
              value="reviews"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-base font-semibold font-display"
            >
              Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger
              value="similar"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-base font-semibold font-display"
            >
              Similar Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 mt-8">
              {/* Submit Review Form */}
              <Card className="p-6 h-fit border-border bg-card shadow-sm">
                <h3 className="text-lg font-bold mb-4 font-display">Write a Review</h3>
                <form
                  onSubmit={handleSubmit(submitReview)}
                  className="space-y-4"
                >
                  <div>
                    <Label className="mb-2 block">Rating</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setValue("rating", star)}
                          className={cn(
                            "text-2xl transition-colors",
                            star <= watchRating
                              ? "text-ember"
                              : "text-muted-foreground/30"
                          )}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Your Review</Label>
                    <Textarea
                      rows={4}
                      placeholder="Share your thoughts..."
                      {...register("text")}
                    />
                    {errors.text && (
                      <p className="text-destructive text-xs mt-1">
                        {errors.text.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      "Submit Review"
                    )}
                  </Button>
                </form>
              </Card>

              {/* Reviews List */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-muted-foreground italic py-8 text-center bg-card border border-border rounded-xl">
                    No reviews yet. Be the first!
                  </p>
                ) : (
                  reviews.map((r: any) => (
                    <Card key={r.id} className="p-5 flex gap-4 border-border bg-card shadow-sm">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary-surface text-primary-ink text-sm font-semibold">
                          {r.user?.email?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-sm">
                            {r.user?.email || "User"}
                          </span>
                          <span className="text-ember text-sm font-semibold">
                            {"★".repeat(r.rating)}
                            {"☆".repeat(5 - r.rating)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 font-data">
                          {formatDate(r.created_at)}
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {r.text}
                        </p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="similar">
            {similarProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                {similarProducts.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/marketplace/${p.id}`}
                    className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 shadow-sm"
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {p.media && p.media.length > 0 ? (
                        <img
                          src={api.mediaUrl(p.media[0].media_url)}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-foreground truncate font-display group-hover:text-primary transition-colors">
                        {p.title}
                      </h3>
                      <p className="text-primary font-bold mt-1 font-data">
                        ${p.price?.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 bg-card border border-border rounded-xl">
                No similar products found
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MarketplaceShell>
  );
}
