"use client";

import { useState, type ReactNode } from "react";
import { Box, Play } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { GalleryItem } from "@/lib/product-gallery";

/**
 * The product page's media: one large stage and a strip of clickable thumbnails
 * beneath it (3D model, every uploaded image, every uploaded video). Picking a
 * thumbnail swaps the stage, so each uploaded view of the product can be seen
 * full size. The 3D viewer is passed in so three.js stays lazy-loaded by the page.
 */
export function ProductGallery({
  items,
  title,
  renderModel,
}: {
  items: GalleryItem[];
  title: string;
  renderModel: (url: string) => ReactNode;
}) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(items[0]?.key);
  const [failed, setFailed] = useState<string[]>([]);
  // If the selected slide disappears (the product refetched), fall back to the first one.
  const selected = items.find((item) => item.key === selectedKey) ?? items[0];
  const model = items.find((item) => item.kind === "model");

  if (!selected) {
    return (
      <div className="h-[420px] lg:h-[520px] rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
        No preview available
      </div>
    );
  }

  const imageCount = items.filter((item) => item.kind === "image").length;

  return (
    <div data-flow="product-gallery" data-selected={selected.kind} className="space-y-3">
      <div className="relative h-[420px] lg:h-[520px] rounded-xl border border-border overflow-hidden bg-muted">
        {/* The viewer stays mounted while an image is shown, so coming back keeps the model and the camera. */}
        {model && (
          <div className={cn("absolute inset-0", selected.kind !== "model" && "hidden")}>
            {renderModel(model.url)}
          </div>
        )}
        {selected.kind === "image" && (
          failed.includes(selected.url) ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Image unavailable
            </div>
          ) : (
            // Uploaded media may live on an administrator-configured storage host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={selected.key}
              src={api.mediaUrl(selected.url)}
              alt={`${title}, photo`}
              decoding="async"
              onError={() => setFailed((list) => [...list, selected.url])}
              className="absolute inset-0 h-full w-full object-contain bg-white"
            />
          )
        )}
        {selected.kind === "video" && (
          <video
            key={selected.key}
            src={api.mediaUrl(selected.url)}
            controls
            preload="metadata"
            playsInline
            aria-label={`${title}, video`}
            className="absolute inset-0 h-full w-full object-contain bg-black"
          />
        )}
      </div>

      {/* What this picture shows, in the creator's words. */}
      {selected.kind === "image" && selected.caption && (
        <p data-flow="image-caption" className="text-sm text-muted-foreground">{selected.caption}</p>
      )}

      {items.length > 1 && (
        <div role="group" aria-label="Product views" className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {items.map((item, index) => {
            const imageNumber = items.slice(0, index + 1).filter((other) => other.kind === "image").length;
            const label =
              item.kind === "model" ? "3D model"
              : item.kind === "video" ? "Video"
              : `Photo ${imageNumber} of ${imageCount}`;
            const active = item.key === selected.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                aria-label={`Show ${label.toLowerCase()}`}
                aria-pressed={active}
                data-kind={item.kind}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--store-focus,currentColor)]",
                  active ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/60"
                )}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={api.mediaUrl(item.thumb)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                    onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                  />
                ) : item.kind === "model" ? (
                  <span className="flex flex-col items-center gap-0.5 text-xs font-semibold text-primary-ink">
                    <Box size={20} aria-hidden="true" />
                    3D
                  </span>
                ) : (
                  <Play size={20} aria-hidden="true" className="text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
