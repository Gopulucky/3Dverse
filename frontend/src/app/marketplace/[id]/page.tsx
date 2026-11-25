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
import { BUY_NOW_PARAM, BUY_NOW_VALUE, saveBuyNow } from "@/lib/buy-now";
import { track } from "@/lib/track-client";
import { displayPrice } from "@/lib/region";
import { useCountry } from "@/stores/region-store";
import { FollowButton } from "@/components/creator/follow-button";
import { availableFormats, defaultFormat, purchasePrice, startingPrice, thumbOf, type PurchaseType } from "@/lib/marketplace";
import { buildGallery } from "@/lib/product-gallery";
import { ProductGallery } from "@/components/product/product-gallery";
import { FormatPicker } from "@/components/product/format-picker";
import { ProductPrices } from "@/components/shared/product-prices";
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
  const { isAuthenticated, user } = useAuthStore();
  const country = useCountry();
  const { setItemCount } = useCartStore();
  const [chosenFormat, setChosenFormat] = useState<PurchaseType | "">("");
  const [selectedConfig, setSelectedConfig] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<any>(`/api/marketplace/products/${id}`),
    enabled: !!id,
  });
  // A listing that sells one format has nothing to choose, so that format is already selected.
  const purchaseType: PurchaseType | "" = chosenFormat || (product ? defaultFormat(product) : "");

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

  // The product's print options as the customer sees them (the first of each is what the selects show).
  const printConfig = (): Record<string, string> => purchaseType === "physical" ? {
    material: product?.available_materials?.[0] || "",
    color: product?.available_colors?.[0] || "",
    size: product?.available_sizes?.[0] || "",
    ...selectedConfig,
  } : {};

  const addToCart = async () => {
    if (adding || !product || purchasePrice(product, purchaseType) == null) return;
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/marketplace/${id}`)}`);
      return;
    }
    setAdding(true);
    setCartMessage("");
    try {
      const cart = await api.post<{ items: unknown[] }>("/api/cart/items", {
        product_id: Number(id), quantity: 1,
        selected_config: { ...printConfig(), purchase_type: purchaseType },
      });
      setItemCount(cart.items.length);
      setCartMessage("Added to cart.");
      track("add_to_cart", { productId: Number(id) });
    } catch {
      setCartMessage("Could not add this product. Please try again.");
    } finally { setAdding(false); }
  };
  const handleAddToCart = () => void addToCart();
  // Buy Now pays for this product alone: it never touches the cart.
  const handleBuyNow = () => {
    if (!product || (purchaseType !== "digital" && purchaseType !== "physical") || purchasePrice(product, purchaseType) == null) return;
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/marketplace/${id}`)}`);
      return;
    }
    track("buy_now", { productId: Number(id) });
    saveBuyNow(sessionStorage, user?.id, { product_id: Number(id), quantity: 1, purchase_type: purchaseType, selected_config: printConfig() });
    router.push(`/checkout?${BUY_NOW_PARAM}=${BUY_NOW_VALUE}`);
  };

  // One anonymous "product viewed" per visit to this product, once it has loaded.
  const viewedId = product?.id;
  useEffect(() => {
    if (viewedId) track("product_view", { productId: viewedId });
  }, [viewedId]);
  const [viewerTracked, setViewerTracked] = useState(false);
  const trackViewerOpened = () => {
    if (viewerTracked) return;
    setViewerTracked(true);
    track("viewer_opened", { productId: Number(id) });
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

  const offeredFormats = availableFormats(product);
  const selectedPrice = purchasePrice(product, purchaseType);
  const canPurchase = selectedPrice != null;
  const latestVersion =
    product.versions && product.versions.length > 0
      ? product.versions[product.versions.length - 1]
      : null;
  // Public shoppers see the decimated preview mesh; the source file is only
  // reachable through the entitlement-checked download endpoint.
  const modelUrl = latestVersion?.preview_url
    ? api.mediaUrl(latestVersion.preview_url)
    : null;

  const gallery = buildGallery(product, modelUrl);
  const fromPrice = startingPrice(product);
  const shownAmount = selectedPrice ?? fromPrice;
  const shownPrice = shownAmount == null ? null : displayPrice(shownAmount, product.currency, country);
  const dimensions = latestVersion?.printability_report?.dimensions;
  const dimensionsText = dimensions
    ? [dimensions.x, dimensions.y, dimensions.z].map((n: number | undefined) => n?.toFixed(0)).join(" × ") + " mm"
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

        {/* The name leads the page, above the pictures, the way a catalogue entry does. */}
        <h1 className="text-2xl sm:text-3xl font-bold mb-5 font-display leading-tight">
          {product.title}
        </h1>

        {/* Row 1 is as tall as the facts and price; row 2 takes whatever height the pictures and buy box add. */}
        <div className="grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-8 lg:gap-x-10 lg:gap-y-6 mb-16 items-start">
          {/* Left: every view of the product (3D model, photos, videos) */}
          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:row-span-2" onPointerDownCapture={trackViewerOpened}>
            <ProductGallery
              key={product.id}
              items={gallery}
              title={product.title}
              renderModel={(url) => <Advanced3DViewer url={url} />}
            />
          </div>

          {/* Middle: who made it and what it costs */}
          <div className="lg:col-span-4 lg:col-start-6 lg:row-start-1 space-y-5">
            <div className="space-y-3">
              {product.creator_name && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm text-muted-foreground">
                    by{" "}
                    {product.creator_id ? (
                      <Link href={`/creators/${product.creator_id}`} data-flow="creator-link" className="font-semibold text-primary-ink underline-offset-2 hover:underline">
                        {product.creator_name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-primary-ink">{product.creator_name}</span>
                    )}
                  </p>
                  {product.creator_id && (
                    <FollowButton creatorId={product.creator_id} creatorName={product.creator_name} size="sm" next={`/marketplace/${product.id}`} />
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 text-sm text-ember-ink font-semibold">
                <Star size={16} fill="currentColor" />
                {avgRating}
                <span className="text-muted-foreground ml-1 font-normal font-data">
                  ({reviews.length} {reviews.length === 1 ? "rating" : "ratings"})
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{product.category}</Badge>
                {offeredFormats.includes("digital") && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Download size={12} className="text-primary" /> Digital
                  </Badge>
                )}
                {offeredFormats.includes("physical") && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Printer size={12} className="text-primary" /> Physical
                  </Badge>
                )}
                {product.is_mode_4_active && (
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Wand2 size={12} className="text-ember-ink" /> Custom
                  </Badge>
                )}
              </div>
            </div>

            {/* Price comes straight after the facts, before the long text. */}
            <div data-flow="product-price" data-state={selectedPrice != null ? "chosen" : fromPrice != null ? "from" : "none"}>
              <p className="font-data text-3xl font-bold text-foreground">
                {selectedPrice != null ? (
                  shownPrice?.main
                ) : fromPrice != null ? (
                  <>
                    <span className="mr-1.5 text-base font-normal text-muted-foreground">From</span>
                    {shownPrice?.main}
                  </>
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">Price unavailable</span>
                )}
              </p>
              {/* Shoppers abroad see an estimate in their currency; the rupee amount is what is charged. */}
              {shownPrice?.charged && (
                <p data-flow="charged-note" className="mt-1 text-sm text-muted-foreground">
                  You are charged <span className="font-data font-medium text-foreground">{shownPrice.charged}</span> (INR). Shown in your currency as an estimate.
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {purchaseType === "digital"
                  ? "Digital model file · download"
                  : purchaseType === "physical"
                  ? "Finished print · before shipping"
                  : offeredFormats.length > 1
                  ? "Choose a format in the box to see its exact price."
                  : ""}
              </p>
              {dimensionsText && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Ruler size={14} aria-hidden="true" className="text-muted-foreground" />
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-data font-medium">{dimensionsText}</span>
                </p>
              )}
            </div>

          </div>

          {/* Right: a short, sticky buy box */}
          <div className="lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:row-span-2">
            <div className="lg:sticky lg:top-24">
              <Card className="p-4 border-border bg-card shadow-lg flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

                <div className="mt-1 mb-4">
                  {offeredFormats.length > 0 ? (
                    <FormatPicker
                      product={product}
                      formats={offeredFormats}
                      value={purchaseType}
                      country={country}
                      onChange={format => { setChosenFormat(format); setCartMessage(""); }}
                    />
                  ) : (
                    <p role="status" className="text-sm text-muted-foreground">
                      This listing can&apos;t be bought yet. The creator hasn&apos;t switched on a format.
                    </p>
                  )}
                  {purchaseType && !canPurchase && <p role="status" className="text-sm mt-2">This format does not have a purchasable price yet.</p>}
                  {product.currency === "USD" && <p className="text-sm mt-2">Legacy USD listing. INR checkout requires the creator to reprice it.</p>}
                </div>

                {/* Print options only appear once a physical print is chosen */}
                {purchaseType === "physical" && (
                  <div className="space-y-4 mb-4">
                    {product.available_materials?.length > 0 && (
                      <div>
                        <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Material</Label>
                        <select aria-label="Material" value={selectedConfig.material || product.available_materials?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, material: event.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                          {product.available_materials.map((m: string) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {product.available_colors?.length > 0 && (
                      <div>
                        <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Color</Label>
                        <select aria-label="Color" value={selectedConfig.color || product.available_colors?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, color: event.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                          {product.available_colors.map((c: string) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {product.available_sizes?.length > 0 && (
                      <div>
                        <Label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Size</Label>
                        <select aria-label="Size" value={selectedConfig.size || product.available_sizes?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, size: event.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                          {product.available_sizes.map((s: string) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {product.is_mode_4_active &&
                      product.mode_4_config &&
                      Object.entries(product.mode_4_config).map(
                        ([key, config]: [string, any]) => (
                          <div key={key}>
                            <Label className="mb-1.5 block capitalize text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              {key.replace("_", " ")}
                            </Label>
                            <Input
                              placeholder={config.description || ""}
                              maxLength={config.maxLength}
                              aria-label={key.replaceAll("_", " ")}
                              value={selectedConfig[key] || ""}
                              onChange={event => setSelectedConfig({ ...selectedConfig, [key]: event.target.value })}
                              className="h-9"
                            />
                          </div>
                        )
                      )}
                  </div>
                )}

                <div className="space-y-2.5 mb-3">
                  <Button
                    onClick={handleAddToCart}
                    disabled={!canPurchase || adding}
                    aria-busy={adding}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm"
                    size="lg"
                  >
                    {adding ? "Adding…" : "Add to cart"}
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    disabled={!canPurchase || adding}
                    className="w-full bg-ember hover:bg-ember-10 text-ember-foreground rounded-full shadow-sm transition-all duration-300"
                    size="lg"
                  >
                    Buy Now
                  </Button>
                </div>

                <p role="status" className="text-sm text-muted-foreground empty:hidden">{cartMessage}</p>

                <div className="flex flex-col pt-3 mt-1 border-t border-border/50 text-sm text-muted-foreground">
                  <p>Sold by {product.creator_name || "the listing creator"}</p>
                  <div className="flex flex-wrap gap-x-4">
                    <Link href="/shipping" className="underline min-h-11 inline-flex items-center">Shipping</Link>
                    <Link href="/refund-policy" className="underline min-h-11 inline-flex items-center">Returns and refunds</Link>
                  </div>
                  <Link href="/grievances#report" className="underline min-h-11 inline-flex items-center">Report this listing</Link>
                  <Button
                    onClick={handleAddToWishlist}
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Heart size={16} /> Add to List
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Below the buy box on a phone, beside the pictures on a desktop: the long reading */}
          <div className="lg:col-span-4 lg:col-start-6 lg:row-start-2 space-y-6">

            <div>
              <h2 className="font-bold text-lg font-display mb-2">About this item</h2>
              <p
                id="product-description"
                className={cn(
                  "text-muted-foreground whitespace-pre-line leading-relaxed text-sm",
                  !descriptionOpen && "line-clamp-5"
                )}
              >
                {product.description}
              </p>
              {(product.description?.length ?? 0) > 260 && (
                <button
                  type="button"
                  onClick={() => setDescriptionOpen(open => !open)}
                  aria-expanded={descriptionOpen}
                  aria-controls="product-description"
                  className="mt-1 min-h-11 text-sm font-semibold text-primary-ink underline"
                >
                  {descriptionOpen ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            <Separator />

            {/* Specifications inline */}
            {(latestVersion || product.license_type) && (
              <div>
                <h2 className="font-bold text-lg font-display mb-3">
                  Product information
                </h2>
                <div className="space-y-1">
                  {dimensionsText && (
                    <SpecRow icon={Ruler} label="Dimensions" value={dimensionsText} />
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
                              ? "text-warning-ink"
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
                              ? "text-ember-ink"
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
                          <span className="text-ember-ink text-sm font-semibold">
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
                          src={api.mediaUrl(thumbOf(p.media[0]) || p.media[0].media_url)}
                          alt={p.title}
                          loading="lazy"
                          decoding="async"
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
                        <ProductPrices product={p} />
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
