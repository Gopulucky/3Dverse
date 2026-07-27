import { ProductGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-background pt-24 px-6 pb-20 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-12 w-full animate-pulse">
        {/* Header/Title Skeleton */}
        <div className="h-12 w-64 skeleton rounded-lg mb-8" />
        
        {/* Content Skeletons */}
        <div className="space-y-6">
          <div className="h-64 w-full skeleton rounded-xl" />
          <ProductGridSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
