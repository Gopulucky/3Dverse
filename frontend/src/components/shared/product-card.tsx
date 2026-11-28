"use client";

import Link from "next/link";
import { Star, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCountry } from "@/stores/region-store";
import { toast } from "sonner";
import { availableFormats, productImage, productThumb, purchasePrice, type ProductCardData, type PurchaseType } from "@/lib/marketplace";
import { displayPrice } from "@/lib/region";
import { ProductImage } from "@/components/shared/product-image";
import { ProductPrices } from "@/components/shared/product-prices";

export type { ProductCardData } from "@/lib/marketplace";

const BADGES: Record<PurchaseType, string> = { digital: "Digital model", physical: "Printed product" };

export function ProductCard({
  p,
  className,
  format,
  compact = false,
}: {
  p: ProductCardData;
  className?: string;
  /** The product type the shopper is filtering by, if any. */
  format?: string;
  /** Image, title and price only: for dense rows such as the home page. */
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuthStore();
  const country = useCountry();
  const href = `/marketplace/${p.id}`;

  if (compact) {
    return (
      <article className={cn("market-product market-product--compact", className)}>
        <Link href={href} className="market-product-image" aria-label={`View ${p.title}`}>
          <ProductImage src={productThumb(p)} fallbackSrc={productImage(p)} title={p.title} />
          {p.is_featured && <span className="market-product-featured">Featured</span>}
        </Link>
        <div className="market-product-info">
          <h3><Link href={href}>{p.title}</Link></h3>
          {p.avg_rating != null && p.avg_rating > 0 && <div className="market-product-modes">
            <span className="market-product-rating"><Star size={14} aria-hidden="true" /> {p.avg_rating.toFixed(1)}</span>
          </div>}
          <div className="market-product-footer"><ProductPrices product={p} format={format} /></div>
        </div>
      </article>
    );
  }

  // One badge and one price: the format being filtered, or else everything on offer.
  const offered = availableFormats(p).filter((value) => !format || value === format);
  const badge = offered.length > 1 ? "Digital + print" : offered[0] ? BADGES[offered[0]] : null;
  const lowest = offered
    .map((value) => ({ value, amount: purchasePrice(p, value) }))
    .filter((entry): entry is { value: PurchaseType; amount: number } => entry.amount !== undefined)
    .sort((a, b) => a.amount - b.amount);
  const price = lowest[0] ? displayPrice(lowest[0].amount, p.currency, country) : null;

  const save = async () => {
    if (!isAuthenticated) { toast.error("Sign in to save products to your wishlist."); return; }
    try { await api.post(`/api/wishlist/${p.id}`); toast.success("Saved to wishlist."); }
    catch { toast.error("Could not save this product. Try again."); }
  };

  return (
    <article className={cn("market-product market-product--card", className)}>
      <div className="market-product-media">
        <Link href={href} className="market-product-image" aria-label={`View ${p.title}`}>
          <ProductImage src={productThumb(p)} fallbackSrc={productImage(p)} title={p.title} />
        </Link>
        {badge && <span className="market-product-badge">{badge}</span>}
        <Button type="button" variant="outline" size="icon" className="market-product-save"
          aria-label={`Save ${p.title} to wishlist`} onClick={() => void save()}>
          <Heart size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="market-product-info">
        {p.category && <p className="market-product-category">{p.category}</p>}
        <h3><Link href={href}>{p.title}</Link></h3>
        {p.creator_name && <p className="market-product-creator">
          By {p.creator_id ? <Link href={`/creators/${p.creator_id}`}>{p.creator_name}</Link> : p.creator_name}
        </p>}
        <div className="market-product-buy">
          <p className="market-product-price">
            {price ? <>
              <span>{lowest.length > 1 && <small>From </small>}{price.main}</span>
              {price.charged && <small>Charged {price.charged}</small>}
              {lowest[0].value === "physical" && <small>plus shipping</small>}
            </> : <small>Price unavailable</small>}
          </p>
          <Button asChild variant="outline" className="market-product-view">
            <Link href={href}>View product</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
