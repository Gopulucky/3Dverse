import { availableFormats, purchasePrice, type ProductCardData } from "@/lib/marketplace";
import { formatMoney } from "@/lib/currency";

export function ProductPrices({ product, format }: { product: ProductCardData; format?: string }) {
  const formats = availableFormats(product).filter(value => !format || value === format);
  if (!formats.length) return <span className="text-sm text-muted-foreground">No purchase format available</span>;
  return <span className="market-price">{formats.map(value => {
    const price = purchasePrice(product, value);
    return <span key={value} className="block">{price == null ? "Price unavailable" : formatMoney(price, product.currency)}<small>{value === "digital" ? "Digital file · download" : "Physical print · before shipping"}</small></span>;
  })}</span>;
}
