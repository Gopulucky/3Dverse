import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductGridSkeleton } from "@/components/ui/skeleton";

export default function MarketplaceLoading() {
  return (
    <MarketplaceShell>
      <div className="store-container catalogue">
        <div className="flex flex-col gap-8">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-10 w-48 skeleton rounded-lg" />
            <div className="h-10 w-32 skeleton rounded-lg" />
          </div>
          {/* Grid Skeleton */}
          <ProductGridSkeleton count={10} />
        </div>
      </div>
    </MarketplaceShell>
  );
}
