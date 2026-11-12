"use client";

import { useState } from "react";
import { api } from "@/lib/api";

/**
 * A list image that loads the small thumbnail and quietly falls back to the
 * original if the thumbnail cannot be fetched. Shows `empty` when neither loads.
 */
export function ThumbImage({ thumb, original, alt, width, height, className, empty = "No image" }: {
  thumb?: string;
  original?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  empty?: string;
}) {
  const sources = [thumb, original].filter((src, i, all): src is string => !!src && all.indexOf(src) === i);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];
  if (!src) return <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{empty}</span>;
  return (
    // Uploaded media may live on an administrator-configured storage host.
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} src={api.mediaUrl(src)} alt={alt} width={width} height={height} loading="lazy" decoding="async"
      className={className} onError={() => setAttempt((n) => n + 1)} />
  );
}
