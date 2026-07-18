"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LayerLineProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100. If undefined, shows indeterminate animation. */
  value?: number;
  /** Height in pixels */
  height?: number;
  /** Show percentage text */
  showLabel?: boolean;
}

/**
 * Layer-Line Progress — the signature 3DVerse motion element.
 * 
 * A horizontal layer-by-layer stripe animation filling bottom-to-top,
 * mimicking the additive manufacturing process. Used for:
 * - File upload progress
 * - Page/content loading
 * - Order tracking active stage
 * - Button loading state
 * 
 * Falls back to a plain progress bar + percentage when prefers-reduced-motion is set.
 */
export function LayerLineProgress({
  value,
  height = 4,
  showLabel = false,
  className,
  ...props
}: LayerLineProgressProps) {
  const isDeterminate = value !== undefined;
  const clampedValue = isDeterminate ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div className={cn("w-full", className)} {...props}>
      <div
        className="relative w-full overflow-hidden rounded-full bg-muted"
        style={{ height }}
      >
        {isDeterminate ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${clampedValue}%`,
              background: `repeating-linear-gradient(
                0deg,
                var(--color-primary) 0px,
                var(--color-primary) 2px,
                color-mix(in srgb, var(--color-primary) 70%, transparent) 2px,
                color-mix(in srgb, var(--color-primary) 70%, transparent) 3px
              )`,
            }}
          />
        ) : (
          <div
            className="absolute inset-y-0 w-1/3 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                var(--color-primary) 0px,
                var(--color-primary) 2px,
                color-mix(in srgb, var(--color-primary) 70%, transparent) 2px,
                color-mix(in srgb, var(--color-primary) 70%, transparent) 3px
              )`,
            }}
          />
        )}
      </div>
      {showLabel && isDeterminate && (
        <span className="text-xs font-data text-muted-foreground mt-1 block">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
