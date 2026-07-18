"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
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
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

// --- 3D Model Components ---
function Model({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | THREE.Group | null>(null);

  useEffect(() => {
    if (!url) return;
    const extension = url.split(".").pop()?.toLowerCase();

    if (extension === "stl") {
      const loader = new STLLoader();
      loader.load(url, (geo) => {
        geo.center();
        setGeometry(geo);
      });
    } else if (extension === "obj") {
      const loader = new OBJLoader();
      loader.load(url, (group) => {
        setGeometry(group);
      });
    }
  }, [url]);

  if (!geometry) return null;

  if (geometry instanceof THREE.BufferGeometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.7} />
      </mesh>
    );
  }
  return <primitive object={geometry} />;
}

function ModelViewer({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border bg-muted relative shadow-sm">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/80 backdrop-blur-xs">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      )}
      <Canvas
        camera={{ position: [0, 0, 150], fov: 50 }}
        onCreated={() => setLoaded(true)}
      >
        <Stage environment="city" intensity={0.5}>
          <Model url={url} />
        </Stage>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={2} />
      </Canvas>
    </div>
  );
}

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
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={15} className="text-primary shrink-0" />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground font-data text-right">
        {value}
      </span>
    </div>
  );
}

// --- Main Page ---
export default function ProductDetailPage() {
  const { id } = useParams();
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
  const modelUrl = latestVersion?.file_url
    ? api.mediaUrl(latestVersion.file_url)
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

        {/* Layout: Two-column 60/40 */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-12 mb-16 items-start">
          {/* Left: 3D Viewer & Media */}
          <div className="space-y-4">
            {modelUrl ? (
              <div className="h-[500px]">
                <ModelViewer url={modelUrl} />
              </div>
            ) : (
              <div className="h-[500px] rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                No 3D Model Available
              </div>
            )}

            {product.media && product.media.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.media.map((m: any) => (
                  <img
                    key={m.id}
                    src={api.mediaUrl(m.media_url)}
                    className="w-20 h-20 object-cover rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    alt="thumbnail"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details & Purchase */}
          <div>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Badge variant="secondary">{product.category}</Badge>
              {product.is_mode_2_active && (
                <Badge variant="outline" className="gap-1">
                  <Download size={12} className="text-primary" /> Digital Download
                </Badge>
              )}
              {product.is_mode_3_active && (
                <Badge variant="outline" className="gap-1">
                  <Printer size={12} className="text-calibration-cyan" /> Physical Print
                </Badge>
              )}
              {product.is_mode_4_active && (
                <Badge variant="outline" className="gap-1">
                  <Wand2 size={12} className="text-nozzle-orange" /> Customizable
                </Badge>
              )}
              <span className="flex items-center gap-1 text-sm text-nozzle-orange font-semibold">
                <Star size={14} fill="currentColor" />
                {avgRating}
                <span className="text-muted-foreground ml-1 font-normal font-data">
                  ({reviews.length} reviews)
                </span>
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold mb-3 font-display">
              {product.title}
            </h1>

            {product.creator_name && (
              <div className="flex items-center gap-2.5 mb-4">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {product.creator_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  by{" "}
                  <span className="font-semibold text-foreground">
                    {product.creator_name}
                  </span>
                </span>
                <BadgeCheck size={15} className="text-calibration-cyan" />
              </div>
            )}
            <p className="text-3xl font-bold text-foreground mb-6 font-data">
              ${product.price?.toFixed(2)}
            </p>

            <p className="text-muted-foreground mb-8 whitespace-pre-line leading-relaxed">
              {product.description}
            </p>

            {/* Order Form */}
            <Card className="p-6 mb-6 space-y-6 border-border bg-card shadow-sm">
              {product.is_mode_3_active && (
                <div className="space-y-4 pb-6 border-b border-border">
                  <h3 className="font-bold text-lg font-display">
                    Physical Print Options
                  </h3>
                  {product.available_materials?.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Material</Label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {product.available_materials.map((m: string) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {product.available_colors?.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Color</Label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {product.available_colors.map((c: string) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {product.available_sizes?.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Size</Label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                  <div className="space-y-4 pb-6 border-b border-border">
                    <h3 className="font-bold text-lg font-display">Customization</h3>
                    {Object.entries(product.mode_4_config).map(
                      ([key, config]: [string, any]) => (
                        <div key={key}>
                          <Label className="mb-2 block capitalize">
                            {key.replace("_", " ")}
                          </Label>
                          <Input
                            placeholder={config.description || ""}
                            maxLength={config.maxLength}
                          />
                        </div>
                      )
                    )}
                  </div>
                )}

              <div className="flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  className="flex-1"
                  size="lg"
                >
                  <ShoppingCart size={18} />
                  Add to Cart
                </Button>
                <Button
                  onClick={handleAddToWishlist}
                  variant="outline"
                  size="lg"
                >
                  <Heart size={18} />
                </Button>
              </div>
            </Card>

            {/* Specifications */}
            {(latestVersion || product.license_type) && (
              <Card className="p-6 border-border bg-card shadow-sm">
                <h3 className="font-bold text-lg font-display mb-2">
                  Specifications
                </h3>
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
                    label="Material Volume"
                    value={`${(latestVersion.printability_report.volume_mm3 / 1000).toFixed(1)} cm³`}
                  />
                )}
                {latestVersion?.file_name && (
                  <SpecRow
                    icon={FileBox}
                    label="File"
                    value={`${latestVersion.file_name.split(".").pop()?.toUpperCase()}${formatBytes(latestVersion.file_size) ? ` · ${formatBytes(latestVersion.file_size)}` : ""}`}
                  />
                )}
                {latestVersion?.printability_report?.status && (
                  <SpecRow
                    icon={ShieldCheck}
                    label="Printability Check"
                    value={
                      <span
                        className={cn(
                          "capitalize",
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
              </Card>
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
                              ? "text-nozzle-orange"
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
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {r.user?.email?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-sm">
                            {r.user?.email || "User"}
                          </span>
                          <span className="text-nozzle-orange text-sm font-semibold">
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
