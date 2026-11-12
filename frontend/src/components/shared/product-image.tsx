"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function ProductImage({ src, fallbackSrc, title, priority = false }: { src?: string; fallbackSrc?: string; title: string; priority?: boolean }) {
  // Show the small copy first; if it cannot load, try the original before giving up.
  const [failed, setFailed] = useState<string[]>([]);
  const shown = [src, fallbackSrc].find((candidate) => candidate && !failed.includes(candidate));
  if (!shown) {
    return <span className="product-image-fallback">Image unavailable</span>;
  }
  return (
    // Uploaded media may live on an administrator-configured storage host.
    // eslint-disable-next-line @next/next/no-img-element
    <img key={shown} src={api.mediaUrl(shown)} alt={title} width={960} height={960}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
      decoding="async" onError={() => setFailed((list) => [...list, shown])} />
  );
}
