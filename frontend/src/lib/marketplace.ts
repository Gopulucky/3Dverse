/** `thumb_url` is a small WebP copy for cards; it is missing on images uploaded before thumbnails existed. */
export interface MediaItem {
  media_url: string;
  thumb_url?: string | null;
  media_type?: string;
  is_primary?: boolean;
}

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
  media?: MediaItem[];
  versions?: { is_latest?: boolean; printability_report?: { status: string } | null }[];
}

export interface HomepageData {
  featured: ProductCardData[];
  trending: ProductCardData[];
  new_arrivals: ProductCardData[];
  categories: { name: string; image?: string }[];
  popular_creators: { name: string; role: string; initials: string; image?: string | null }[];
  /** What the storefront may promise; read it through storeAvailability(). */
  availability?: { checkout?: boolean; printed?: boolean };
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

function chosenImage(product: ProductCardData): MediaItem | undefined {
  // Video uploads must not become broken <img> elements in the catalogue.
  const images = product.media?.filter((media) =>
    media.media_type !== "video" && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(media.media_url)
  );
  return images?.find((media) => media.is_primary) || images?.[0];
}

/** The full-size image, for the product page and sharing. */
export function productImage(product: ProductCardData): string | undefined {
  return chosenImage(product)?.media_url;
}

/** The small copy when there is one, else the original. Use this on cards, the cart and lists. */
export function thumbOf(media?: MediaItem): string | undefined {
  return media ? media.thumb_url || media.media_url : undefined;
}

export function productThumb(product: ProductCardData): string | undefined {
  return thumbOf(chosenImage(product));
}
