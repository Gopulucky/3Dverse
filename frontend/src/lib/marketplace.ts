export interface ProductCardData {
  id: number;
  title: string;
  category?: string;
  price?: number;
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

/** Video uploads must not become broken <img> elements in the catalogue. */
export function productImage(product: ProductCardData): string | undefined {
  const images = product.media?.filter((media) =>
    media.media_type !== "video" && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(media.media_url)
  );
  return images?.find((media) => media.is_primary)?.media_url || images?.[0]?.media_url;
}
