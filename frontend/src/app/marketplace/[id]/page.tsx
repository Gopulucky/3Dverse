"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star, Heart, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { includedRows, printRows, type DetailRow } from "@/lib/product-details";
import { BUY_NOW_PARAM, BUY_NOW_VALUE, saveBuyNow } from "@/lib/buy-now";
import { track } from "@/lib/track-client";
import { displayPrice } from "@/lib/region";
import { useCountry } from "@/stores/region-store";
import { FollowButton } from "@/components/creator/follow-button";
import { availableFormats, defaultFormat, purchasePrice, startingPrice, type PurchaseType, type ProductCardData } from "@/lib/marketplace";
import { buildGallery } from "@/lib/product-gallery";
import { ProductGallery } from "@/components/product/product-gallery";
import { FormatPicker } from "@/components/product/format-picker";
import { ProductCard } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function DetailTable({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="spec-table">
      {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
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
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const creatorId: number | undefined = product?.creator_id;
  const { data: creator } = useQuery({
    queryKey: ["creator", creatorId],
    queryFn: () => api.get<{ name: string; product_count: number }>(`/api/creators/${creatorId}`),
    enabled: !!creatorId,
    retry: false,
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
      setReviewOpen(false);
      refetchReviews();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : "Your review was not saved. Try again.");
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
        <div className="store-container pt-6 pb-24">
          <div className="product-layout">
            <Skeleton className="h-[420px] lg:h-[600px] rounded-[var(--store-radius)]" />
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  const reviewCount = `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`;
  const included = includedRows(product, offeredFormats);
  const printing = printRows(product.print_settings);
  // Delivery wording follows the format being bought.
  const sellsDigital = offeredFormats.includes("digital") && purchaseType !== "physical";
  const needsShipping = offeredFormats.includes("physical") && purchaseType !== "digital";

  return (
    <MarketplaceShell>
      <div className="store-container pt-6 pb-24">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/marketplace" className="inline-flex min-h-11 items-center hover:text-foreground">Marketplace</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link href={`/marketplace?category=${encodeURIComponent(product.category || "")}`} className="inline-flex min-h-11 items-center hover:text-foreground">{product.category}</Link>
        </nav>

        <div className="product-layout">
          {/* Every view of the product: 3D model, photos, videos */}
          <div className="product-media" onPointerDownCapture={trackViewerOpened}>
            <ProductGallery
              key={product.id}
              items={gallery}
              title={product.title}
              renderModel={(url) => <Advanced3DViewer url={url} />}
            />
          </div>

          <div className="product-buy" data-flow="buy-box">
            {/* On a phone this block moves above the pictures. */}
            <div className="product-heading">
              <h1 className="display text-2xl sm:text-3xl lg:text-4xl">{product.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {product.creator_name && (
                <p>By{" "}{product.creator_id
                  ? <Link href={`/creators/${product.creator_id}`} data-flow="creator-link" className="font-semibold text-primary-ink underline-offset-2 hover:underline">{product.creator_name}</Link>
                  : <span className="font-semibold text-foreground">{product.creator_name}</span>}
                </p>
              )}
              {avgRating && (
                <a href="#reviews" className="inline-flex min-h-11 items-center gap-1 text-foreground">
                  <Star size={14} aria-hidden="true" /> {avgRating} <span className="text-muted-foreground">({reviewCount})</span>
                </a>
              )}
              </div>
            </div>

            <div data-flow="product-price" data-state={selectedPrice != null ? "chosen" : fromPrice != null ? "from" : "none"}>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
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
                  You are charged <span className="font-medium text-foreground tabular-nums">{shownPrice.charged}</span> (INR). Shown in your currency as an estimate.
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {purchaseType === "digital" ? "Digital model, one-time purchase"
                  : purchaseType === "physical" ? "Finished print, shipping added at checkout"
                  : offeredFormats.length > 1 ? "Choose a format to see its exact price." : ""}
              </p>
              {product.license_type && <p className="text-sm text-muted-foreground">Licence: {product.license_type}</p>}
            </div>

            <div>
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
              <div className="space-y-4">
                {product.available_materials?.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block text-sm">Material</Label>
                    <select aria-label="Material" value={selectedConfig.material || product.available_materials?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, material: event.target.value })} className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                      {product.available_materials.map((option: string) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                )}
                {product.available_colors?.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block text-sm">Color</Label>
                    <select aria-label="Color" value={selectedConfig.color || product.available_colors?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, color: event.target.value })} className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                      {product.available_colors.map((option: string) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                )}
                {product.available_sizes?.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block text-sm">Size</Label>
                    <select aria-label="Size" value={selectedConfig.size || product.available_sizes?.[0] || ""} onChange={event => setSelectedConfig({ ...selectedConfig, size: event.target.value })} className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                      {product.available_sizes.map((option: string) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                )}
                {product.is_mode_4_active && product.mode_4_config && Object.entries(product.mode_4_config).map(([key, config]: [string, any]) => (
                  <div key={key}>
                    <Label className="mb-1.5 block capitalize text-sm">{key.replace("_", " ")}</Label>
                    <Input
                      placeholder={config.description || ""}
                      maxLength={config.maxLength}
                      aria-label={key.replaceAll("_", " ")}
                      value={selectedConfig[key] || ""}
                      onChange={event => setSelectedConfig({ ...selectedConfig, [key]: event.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Buying this one thing comes first; collecting for later second. */}
            <div className="flex flex-col gap-2">
              <Button onClick={handleBuyNow} disabled={!canPurchase || adding} className="w-full bg-ember hover:bg-ember-10 text-ember-foreground" size="lg">
                Buy now
              </Button>
              <Button variant="outline" onClick={handleAddToCart} disabled={!canPurchase || adding} aria-busy={adding} className="w-full" size="lg">
                {adding ? "Adding…" : "Add to cart"}
              </Button>
              <p role="status" className="text-sm text-muted-foreground empty:hidden">{cartMessage}</p>
              {sellsDigital && <p className="text-sm text-muted-foreground">Download the file from your orders once payment is confirmed.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 border-t border-border pt-2 text-sm text-muted-foreground">
              <button type="button" onClick={handleAddToWishlist} className="inline-flex min-h-11 items-center gap-2 hover:text-foreground">
                <Heart size={16} aria-hidden="true" /> Save to wishlist
              </button>
              <Link href="/refund-policy" className="inline-flex min-h-11 items-center underline">Returns and refunds</Link>
              {needsShipping && <Link href="/shipping" className="inline-flex min-h-11 items-center underline">Shipping</Link>}
              <Link href="/grievances#report" className="inline-flex min-h-11 items-center underline">Report this listing</Link>
            </div>
          </div>
        </div>

        <div className="product-details">
          {product.description && (
            <section className="product-section" aria-labelledby="about-heading">
              <h2 id="about-heading">About this design</h2>
              <div>
              <p id="product-description" className={cn("max-w-[70ch] whitespace-pre-line leading-relaxed text-muted-foreground", !descriptionOpen && "line-clamp-5")}>
                {product.description}
              </p>
              {product.description.length > 260 && (
                <button type="button" onClick={() => setDescriptionOpen(open => !open)} aria-expanded={descriptionOpen} aria-controls="product-description" className="mt-1 min-h-11 text-sm font-semibold text-primary-ink underline">
                  {descriptionOpen ? "Show less" : "Read more"}
                </button>
              )}
              </div>
            </section>
          )}

          {included.length > 0 && (
            <section className="product-section" aria-labelledby="included-heading">
              <h2 id="included-heading">What&apos;s included</h2>
              <DetailTable rows={included} />
            </section>
          )}

          {printing.length > 0 && (
            <section className="product-section" aria-labelledby="printing-heading">
              <h2 id="printing-heading">Printing specifications</h2>
              <DetailTable rows={printing} />
            </section>
          )}

          {product.creator_id && product.creator_name && (
            <section className="product-section" aria-labelledby="creator-heading">
              <h2 id="creator-heading">Creator</h2>
              <div className="flex flex-wrap items-center gap-4 max-w-2xl">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary-surface text-primary-ink font-semibold">{product.creator_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="mr-auto min-w-0">
                  <p className="font-display font-semibold">{product.creator_name}</p>
                  {creator && <p className="text-sm text-muted-foreground">{creator.product_count} {creator.product_count === 1 ? "design" : "designs"}</p>}
                </div>
                <FollowButton creatorId={product.creator_id} creatorName={product.creator_name} size="sm" next={`/marketplace/${product.id}`} />
                <Link href={`/creators/${product.creator_id}`} className="inline-flex min-h-11 items-center text-sm font-medium underline">View profile</Link>
              </div>
            </section>
          )}

          <section id="reviews" className="product-section" aria-labelledby="reviews-heading">
            <h2 id="reviews-heading">Reviews</h2>
            <div>
            {reviews.length === 0
              ? <p className="text-muted-foreground">No reviews yet.</p>
              : <p className="mb-2 text-muted-foreground">{avgRating} out of 5 from {reviewCount}</p>}
            {reviews.length > 0 && (
              <ul className="divide-y divide-border">
                {reviews.map((r: any) => (
                  <li key={r.id} className="py-4">
                    <p className="flex flex-wrap items-center gap-x-3 text-sm">
                      <span className="font-semibold">{r.reviewer_name || "Verified buyer"}</span>
                      <span className="text-ember-ink" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                    </p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-sm text-muted-foreground">Only people who bought this design can review it.</p>
            {!isAuthenticated ? (
              <Link href={`/login?next=${encodeURIComponent(`/marketplace/${product.id}`)}`} className="inline-flex min-h-11 items-center text-sm font-medium underline">Sign in to write a review</Link>
            ) : !reviewOpen ? (
              <Button type="button" variant="outline" className="mt-2" onClick={() => setReviewOpen(true)}>Write a review</Button>
            ) : (
              <form onSubmit={handleSubmit(submitReview)} className="mt-4 max-w-lg space-y-4">
                <fieldset>
                  <legend className="mb-1 text-sm font-medium">Rating</legend>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setValue("rating", star)} aria-label={`${star} out of 5`} aria-pressed={star === watchRating}
                        className={cn("min-h-11 min-w-11 text-2xl", star <= watchRating ? "text-ember-ink" : "text-muted-foreground")}>
                        {star <= watchRating ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <Label htmlFor="review-text" className="mb-2 block">Your review</Label>
                  <Textarea id="review-text" rows={4} {...register("text")} />
                  {errors.text && <p className="text-destructive text-sm mt-1">{errors.text.message}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" size={16} aria-label="Sending" /> : "Submit review"}</Button>
                  <Button type="button" variant="ghost" onClick={() => setReviewOpen(false)}>Cancel</Button>
                </div>
              </form>
            )}
            </div>
          </section>
        </div>

        {similarProducts.length > 0 && (
          <section className="product-section product-section--wide" aria-labelledby="similar-heading">
            <h2 id="similar-heading">Similar designs</h2>
            <div className="catalogue-grid">
              {(similarProducts as ProductCardData[]).map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        )}
      </div>
    </MarketplaceShell>
  );
}
