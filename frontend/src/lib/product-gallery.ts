import type { MediaItem } from "@/lib/marketplace";

/** One slide in the product page gallery: the 3D model, an uploaded image, or an uploaded video. */
export type GalleryItem =
  | { key: "model"; kind: "model"; url: string; thumb?: undefined }
  | { key: string; kind: "image"; url: string; thumb: string; caption?: string }
  | { key: string; kind: "video"; url: string; thumb?: undefined };

type GalleryMedia = MediaItem & { id?: number };

const VIDEO_FILE = /\.(mp4|webm|mov)(?:[?#]|$)/i;

function isVideo(media: GalleryMedia): boolean {
  return media.media_type === "video" || VIDEO_FILE.test(media.media_url);
}

/**
 * Everything a shopper can look at, in order: the 3D preview first (it is what
 * the listing sells), then the uploaded images with the primary one leading,
 * then videos. Every uploaded file is shown, so nothing a creator adds is hidden.
 */
export function buildGallery(
  product: { media?: GalleryMedia[] },
  modelUrl?: string | null,
): GalleryItem[] {
  const items: GalleryItem[] = [];
  if (modelUrl) items.push({ key: "model", kind: "model", url: modelUrl });

  const media = product.media ?? [];
  const keyOf = (item: GalleryMedia, index: number) => `media-${item.id ?? index}`;
  const images = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isVideo(item));
  // Array.prototype.sort is stable, so non-primary images keep their upload order.
  images.sort((a, b) => Number(!!b.item.is_primary) - Number(!!a.item.is_primary));
  for (const { item, index } of images) {
    items.push({
      key: keyOf(item, index),
      kind: "image",
      url: item.media_url,
      thumb: item.thumb_url || item.media_url,
      caption: item.caption?.trim() || undefined,
    });
  }
  media.forEach((item, index) => {
    if (isVideo(item)) items.push({ key: keyOf(item, index), kind: "video", url: item.media_url });
  });
  return items;
}
