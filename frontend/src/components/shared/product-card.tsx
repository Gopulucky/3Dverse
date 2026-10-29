"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, Download, Printer, Wand2, Loader2, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { productImage, type ProductCardData } from "@/lib/marketplace";
import { ProductImage } from "@/components/shared/product-image";

export type { ProductCardData } from "@/lib/marketplace";

export function ProductCard({
  p,
  onWishlist,
  className,
}: {
  p: ProductCardData;
  onWishlist?: (id: number) => void;
  className?: string;
}) {
  const { isAuthenticated } = useAuthStore();
  const { setItemCount } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const latestVersion = p.versions?.find((version) => version.is_latest);
  const printable = latestVersion?.printability_report?.status.toLowerCase() === "pass";

  const handleAddToCart = async () => {
    if (isAdding) return;
    setCartMessage("");
    if (!isAuthenticated) {
      toast.error("Please login to add to cart");
      return;
    }
    setIsAdding(true);
    try {
      const cart = await api.post<{ items: unknown[] }>("/api/cart/items", {
        product_id: p.id,
        quantity: 1,
        selected_config: {},
      });
      setItemCount(cart.items.length);
      setCartMessage("Added to cart.");
    } catch {
      setCartMessage("Could not add to cart. Try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const priceStr = p.price == null ? null : `$${p.price.toFixed(2)}`;
  const reviews = p.review_count ?? 0;

  return (
    <article className={cn("market-product", className)}>
      <Link href={`/marketplace/${p.id}`} className="market-product-image" aria-label={`View ${p.title}`}>
        <ProductImage src={productImage(p)} title={p.title} />
        {p.is_featured && <span className="market-product-featured">Featured</span>}
      </Link>
      <div className="market-product-info">
        <div className="market-product-heading">
          <h3><Link href={`/marketplace/${p.id}`}>{p.title}</Link></h3>
          {onWishlist && <Button type="button" variant="ghost" size="icon"
            aria-label={`Save ${p.title} to wishlist`} onClick={() => onWishlist(p.id)}>
            <Heart size={18} aria-hidden="true" />
          </Button>}
        </div>
        {p.creator_name && <p className="market-product-creator">By {p.creator_name}</p>}
        <div className="market-product-reviews">
          {p.avg_rating != null && p.avg_rating > 0 && <span className="market-product-rating">
            <Star size={14} aria-hidden="true" /> {p.avg_rating.toFixed(1)}
          </span>}
          <span>{reviews} {reviews === 1 ? "review" : "reviews"}</span>
          {printable && <span className="market-product-verified">Printability passed</span>}
        </div>
        <div className="market-product-modes">
          {p.is_mode_2_active && <span><Download size={14} aria-hidden="true" /> Digital file</span>}
          {p.is_mode_3_active && <span><Printer size={14} aria-hidden="true" /> Physical print</span>}
          {p.is_mode_4_active && <span><Wand2 size={14} aria-hidden="true" /> Customizable</span>}
        </div>
        <div className="market-product-footer">
          <span className="market-price">{priceStr ?? "Price unavailable"}</span>
          <Link className="market-text-link" href={`/marketplace/${p.id}`}>View model</Link>
        </div>
        <Button type="button" variant="outline" className="market-cart-button"
          onClick={handleAddToCart} disabled={isAdding} aria-busy={isAdding}
          aria-label={`Add ${p.title} to cart`}>
          {isAdding && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isAdding ? "Adding…" : "Add to cart"}
        </Button>
        <p className="market-cart-message" role="status">{cartMessage}</p>
      </div>
    </article>
  );
}
