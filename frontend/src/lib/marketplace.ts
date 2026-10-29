export interface ProductCardData {
  id: number;
  title: string;
  category?: string;
  price?: number;
  currency?: string;
  base_print_price?: number;
  digital_download_enabled?: boolean;
  avg_rating?: number | null;
  review_count?: number;
  creator_name?: string | null;
  is_featured?: boolean;
  is_mode_2_active?: boolean;
  is_mode_3_active?: boolean;
  is_mode_4_active?: boolean;
  media?: { media_url: string; media_type?: string; is_primary?: boolean }[];
  versions?: { is_latest?: boolean; printability_report?: { status: string } | null }[];
}

export interface HomepageData {
  featured: ProductCardData[];
  trending: ProductCardData[];
  new_arrivals: ProductCardData[];
  categories: { name: string; image?: string }[];
  popular_creators: { name: string; role: string; initials: string; image?: string | null }[];
}

export type PurchaseType = "digital" | "physical";

export function availableFormats(product: ProductCardData): PurchaseType[] {
  const formats: PurchaseType[] = [];
  if (product.is_mode_2_active && product.digital_download_enabled) formats.push("digital");
  if (product.is_mode_3_active || product.is_mode_4_active) formats.push("physical");
  return formats;
}

/** An explicit offered format is required; an unpriced print cannot be bought. */
export function purchasePrice(product: ProductCardData, format?: string): number | undefined {
  if (!availableFormats(product).includes(format as PurchaseType)) return undefined;
  const amount = format === "physical" ? product.base_print_price : product.price;
  if (amount == null || !Number.isFinite(amount) || amount < 0 || (format === "physical" && amount === 0)) return undefined;
  return amount;
}

/** Video uploads must not become broken <img> elements in the catalogue. */
export function productImage(product: ProductCardData): string | undefined {
  const images = product.media?.filter((media) =>
    media.media_type !== "video" && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(media.media_url)
  );
  return images?.find((media) => media.is_primary)?.media_url || images?.[0]?.media_url;
}
