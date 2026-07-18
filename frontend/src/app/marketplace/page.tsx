"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filtersKey, setFiltersKey] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (category) params.category = category;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    return params;
  }, [debouncedQuery, category, minPrice, maxPrice]);

  const {
    data: products = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["marketplace-products", debouncedQuery, category, minPrice, maxPrice, filtersKey],
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
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <div className="w-full md:w-64 shrink-0">
        <Card className="p-5 sticky top-24 border-border bg-card shadow-sm">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-6 font-display">
            <SlidersHorizontal size={18} />
            Filters
          </h3>

          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="mb-2 block">Price Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  mono
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  mono
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={applyFilters}
              className="w-full"
            >
              Apply Filters
            </Button>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Search */}
        <div className="relative mb-8">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={20}
          />
          <Input
            type="text"
            placeholder="Search by title, description, or tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-4 py-6 rounded-full text-base border-border bg-card shadow-sm focus-visible:ring-offset-0"
          />
        </div>

        {isLoading ? (
          <ProductGridSkeleton count={6} />
        ) : (
          <>
            <p className="text-muted-foreground text-sm mb-6 font-data">
              {products.length} product(s) found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p: any) => (
                <ProductCard key={p.id} p={p} onWishlist={handleAddToWishlist} />
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg mb-4 font-display">
                  No products found matching your criteria
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setMinPrice("");
                    setMaxPrice("");
                    setFiltersKey((prev) => prev + 1);
                  }}
                >
                  Clear Filters
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
