"use client";

import { availableFormats, purchasePrice, type ProductCardData } from "@/lib/marketplace";
import { displayPrice } from "@/lib/region";
import { useCountry } from "@/stores/region-store";

export function ProductPrices({ product, format }: { product: ProductCardData; format?: string }) {
  const country = useCountry();
  const formats = availableFormats(product).filter(value => !format || value === format);
  if (!formats.length) return <span className="text-sm text-muted-foreground">No purchase format available</span>;
  return <span className="market-price">{formats.map(value => {
    const price = purchasePrice(product, value);
    const view = price == null ? null : displayPrice(price, product.currency, country);
    return <span key={value} className="block">{view ? view.main : "Price unavailable"}<small>{value === "digital" ? "Digital file · download" : "Physical print · before shipping"}{view?.charged ? ` · charged ${view.charged}` : ""}</small></span>;
  })}</span>;
}
