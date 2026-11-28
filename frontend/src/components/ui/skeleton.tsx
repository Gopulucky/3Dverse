import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-lg", className)}
      {...props}
    />
  );
}

function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="catalogue-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[var(--store-radius)] border border-border overflow-hidden">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, ProductGridSkeleton };
