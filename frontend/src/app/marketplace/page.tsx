"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, PackageX, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";

const CATEGORIES = [
  "Tabletop",
  "Jewelry",
  "Cosplay",
  "Miniatures",
  "Home Decor",
  "Gadgets",
];

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "";
  const { isAuthenticated } = useAuthStore();

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filtersKey, setFiltersKey] = useState(0);

  // Sync state with URL changes
  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (category) params.category = category;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (sortBy) params.sort = sortBy;
    return params;
  }, [debouncedQuery, category, minPrice, maxPrice, sortBy]);

  const {
    data: products = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["marketplace-products", debouncedQuery, category, minPrice, maxPrice, sortBy, filtersKey],
    queryFn: () =>
      api.get<any[]>("/api/marketplace/products", buildParams()),
  });

  const handleAddToWishlist = async (productId: number) => {
    if (!isAuthenticated) {
      toast.error("Please login to add to wishlist");
      return;
    }

    try {
      await api.post(`/api/wishlist/${productId}`);
      toast.success("Added to wishlist!");
    } catch {
      toast.error("Failed to add to wishlist");
    }
  };

  const applyFilters = () => {
    setFiltersKey((prev) => prev + 1);
  };

  return (
    <div className="w-full mx-auto px-4 md:px-8 pt-6 pb-20 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <div className="w-full md:w-[220px] shrink-0">
        <div className="sticky top-[128px] pr-4 border-r border-border/50 min-h-[calc(100vh-8rem)]">
          <div className="mb-8">
            <h3 className="font-bold text-[12px] mb-3 text-muted-foreground tracking-widest uppercase">Category</h3>
            <div className="flex flex-col space-y-1.5">
              <button
                onClick={() => { setCategory(""); applyFilters(); }}
                className={cn("text-[14px] text-left w-full transition-colors", category === "" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                All Categories
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); applyFilters(); }}
                  className={cn("text-[14px] text-left w-full transition-colors", category === c ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-[12px] mb-3 text-muted-foreground tracking-widest uppercase">Price</h3>
            <div className="flex flex-col space-y-1.5 mb-4">
              <button
                onClick={() => { setMinPrice(""); setMaxPrice("25"); applyFilters(); }}
                className={cn("text-[14px] text-left w-full transition-colors", minPrice === "" && maxPrice === "25" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Under $25
              </button>
              <button
                onClick={() => { setMinPrice("25"); setMaxPrice("50"); applyFilters(); }}
                className={cn("text-[14px] text-left w-full transition-colors", minPrice === "25" && maxPrice === "50" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                $25 to $50
              </button>
              <button
                onClick={() => { setMinPrice("50"); setMaxPrice("100"); applyFilters(); }}
                className={cn("text-[14px] text-left w-full transition-colors", minPrice === "50" && maxPrice === "100" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                $50 to $100
              </button>
              <button
                onClick={() => { setMinPrice("100"); setMaxPrice(""); applyFilters(); }}
                className={cn("text-[14px] text-left w-full transition-colors", minPrice === "100" && maxPrice === "" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                $100 & Above
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="$ Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-9 text-[13px] w-20 px-2 bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary rounded-md"
              />
              <span className="text-muted-foreground/50">-</span>
              <Input
                type="number"
                placeholder="$ Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-9 text-[13px] w-20 px-2 bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary rounded-md"
              />
              <Button onClick={applyFilters} size="sm" variant="secondary" className="h-9 px-3 text-[13px] rounded-md font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">Go</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-border/50 gap-4">
          <div className="text-sm font-medium">
            {isLoading ? (
              <span className="text-muted-foreground">Searching...</span>
            ) : (
              <>
                Showing {products.length > 0 ? "1-" + products.length : "0"} of {products.length} results
                {debouncedQuery && <span> for <span className="font-bold text-primary">&quot;{debouncedQuery}&quot;</span></span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); applyFilters(); }}
              className="text-sm border border-border/50 rounded-md bg-muted/30 px-2 py-1.5 focus:outline-none focus:border-primary shadow-sm cursor-pointer"
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <ProductGridSkeleton count={6} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
              {products.map((p: any) => (
                <ProductCard key={p.id} p={p} onWishlist={handleAddToWishlist} />
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-24 flex flex-col items-center">
                <PackageX size={64} className="text-muted-foreground/30 mb-6" />
                <h3 className="font-bold text-xl mb-2">No results for {debouncedQuery ? `"${debouncedQuery}"` : "your criteria"}</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-md">
                  Try checking your spelling or use more general terms. You can also try clearing your filters to see more results.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setDebouncedQuery("");
                    setCategory("");
                    setMinPrice("");
                    setMaxPrice("");
                    setFiltersKey((prev) => prev + 1);
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <MarketplaceShell>
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
            <ProductGridSkeleton count={6} />
          </div>
        }
      >
        <MarketplaceContent />
      </Suspense>
    </MarketplaceShell>
  );
}
