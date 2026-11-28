"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, Wand2, Loader2, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { productImage, productThumb, purchasePrice, type ProductCardData } from "@/lib/marketplace";
import { ProductImage } from "@/components/shared/product-image";
import { ProductPrices } from "@/components/shared/product-prices";

export type { ProductCardData } from "@/lib/marketplace";

export function ProductCard({
  p,
  onWishlist,
  className,
  format,
  compact = false,
}: {
  p: ProductCardData;
  onWishlist?: (id: number) => void;
  className?: string;
  format?: string;
  /** Image, title, formats and price only: for dense rows such as the home page. */
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuthStore();
  const { setItemCount } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const handleAddToCart = async () => {
    if (isAdding || purchasePrice(p, format) == null) return;
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
        selected_config: { purchase_type: format },
      });
      setItemCount(cart.items.length);
      setCartMessage("Added to cart.");
    } catch {
      setCartMessage("Could not add to cart. Try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const reviews = p.review_count ?? 0;

  if (compact) {
    return (
      <article className={cn("market-product market-product--compact", className)}>
        <Link href={`/marketplace/${p.id}`} className="market-product-image" aria-label={`View ${p.title}`}>
          <ProductImage src={productThumb(p)} fallbackSrc={productImage(p)} title={p.title} />
          {p.is_featured && <span className="market-product-featured">Featured</span>}
        </Link>
        <div className="market-product-info">
          <h3><Link href={`/marketplace/${p.id}`}>{p.title}</Link></h3>
          {p.avg_rating != null && p.avg_rating > 0 && <div className="market-product-modes">
            <span className="market-product-rating"><Star size={14} aria-hidden="true" /> {p.avg_rating.toFixed(1)}</span>
          </div>}
          <div className="market-product-footer"><ProductPrices product={p} format={format} /></div>
        </div>
      </article>
    );
  }

  // One action per card: add to cart when the chosen format allows it, otherwise open the product.
  const canAdd = Boolean(format) && purchasePrice(p, format) != null;
  const rated = reviews > 0 && p.avg_rating != null && p.avg_rating > 0;

  return (
    <article className={cn("market-product", className)}>
      <div className="market-product-media">
        <Link href={`/marketplace/${p.id}`} className="market-product-image" aria-label={`View ${p.title}`}>
          <ProductImage src={productThumb(p)} fallbackSrc={productImage(p)} title={p.title} />
          {p.is_featured && <span className="market-product-featured">Featured</span>}
        </Link>
        {onWishlist && <Button type="button" variant="outline" size="icon" className="market-product-save"
          aria-label={`Save ${p.title} to wishlist`} onClick={() => onWishlist(p.id)}>
          <Heart size={18} aria-hidden="true" />
        </Button>}
      </div>
      <div className="market-product-info">
        <h3><Link href={`/marketplace/${p.id}`}>{p.title}</Link></h3>
        {p.creator_name && <p className="market-product-creator">
          By {p.creator_id ? <Link href={`/creators/${p.creator_id}`}>{p.creator_name}</Link> : p.creator_name}
        </p>}
        {reviews > 0 && <p className="market-product-reviews">
          {rated && <span className="market-product-rating"><Star size={14} aria-hidden="true" /> {p.avg_rating!.toFixed(1)}</span>}
          <span>{reviews} {reviews === 1 ? "review" : "reviews"}</span>
        </p>}
        {p.is_mode_4_active && <p className="market-product-modes"><Wand2 size={14} aria-hidden="true" /> Customizable</p>}
        <div className="market-product-footer">
          <ProductPrices product={p} format={format} />
        </div>
        {canAdd ? <>
          <Button type="button" variant="outline" className="market-cart-button"
            onClick={handleAddToCart} disabled={isAdding} aria-busy={isAdding}
            aria-label={`Add ${p.title} to cart`}>
            {isAdding && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isAdding ? "Adding…" : "Add to cart"}
          </Button>
          <p className="market-cart-message" role="status">{cartMessage}</p>
        </> : <Button asChild variant="outline" className="market-cart-button">
          <Link href={`/marketplace/${p.id}`}>View product</Link>
        </Button>}
      </div>
    </article>
  );
}
