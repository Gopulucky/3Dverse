"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function ProductImage({ src, title, priority = false }: { src?: string; title: string; priority?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || src === failedSrc) {
    return <span className="product-image-fallback">Image unavailable</span>;
  }
  return (
    // Uploaded media may live on an administrator-configured storage host.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={api.mediaUrl(src)} alt={title} width={960} height={960}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
      decoding="async" onError={() => setFailedSrc(src)} />
  );
}
