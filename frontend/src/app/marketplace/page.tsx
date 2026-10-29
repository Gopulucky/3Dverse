"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { type ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";

const CATEGORIES = ["Tabletop", "Jewelry", "Cosplay", "Miniatures", "Home Decor", "Gadgets", "Architecture", "Engineering", "Medical", "Gaming"];
const PAGE_SIZE = 20;

function MarketplaceContent() {
  const search = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const format = search.get("format") || "";
  const page = Math.max(1, Number.parseInt(search.get("page") || "1", 10) || 1);
  const params: Record<string, string> = { skip: String((page - 1) * PAGE_SIZE), limit: "21" };
  for (const key of ["q", "category", "format", "currency", "sort", "min_price", "max_price"]) {
    const value = search.get(key);
    if (value) params[key] = value;
  }
  const { data = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["marketplace-products", params],
    queryFn: () => api.get<ProductCardData[]>("/api/marketplace/products", params),
    retry: false,
  });
  const products = data.slice(0, PAGE_SIZE);
  const hasNext = data.length > PAGE_SIZE;
  const goToPage = (next: number) => {
    const nextParams = new URLSearchParams(search.toString());
    nextParams.set("page", String(next));
    router.push(`/marketplace?${nextParams}`);
  };
  const handleAddToWishlist = async (id: number) => {
    if (!isAuthenticated) { toast.error("Sign in to save products to your wishlist."); return; }
    try { await api.post(`/api/wishlist/${id}`); toast.success("Saved to wishlist."); }
    catch { toast.error("Could not save this product. Try again."); }
  };
  const control = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="store-container py-8 pb-20">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3">{format === "physical" ? "Printed products" : format === "digital" ? "Digital models" : "Shop 3D models and prints"}</h1>
        <p className="text-muted-foreground">{format === "physical" ? "Finished 3D prints made and shipped to you. No printer needed. Check each listing for available options." : format === "digital" ? "Downloadable model files for your own 3D printer. These purchases do not include a physical product." : "Choose a delivered physical product or a digital model file for your own printer. Each listing offers its own formats."}</p>
      </header>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-56 shrink-0">
          <form key={search.toString()} className="space-y-5" aria-label="Catalogue filters" onSubmit={event => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const next = new URLSearchParams();
            for (const [key, value] of values) if (String(value).trim()) next.set(key, String(value).trim());
            // Prices in different currencies cannot be compared without conversion.
            if ((next.get("sort")?.startsWith("price_") || next.has("min_price") || next.has("max_price")) && !next.has("currency")) next.set("currency", "INR");
            router.push(`/marketplace?${next}`);
          }}>
            <div><Label htmlFor="catalogue-search">Search products</Label><Input id="catalogue-search" name="q" type="search" defaultValue={search.get("q") || ""} className="mt-2 min-h-11" placeholder="Try miniatures or home decor" /></div>
            <div><Label htmlFor="catalogue-format">What would you like?</Label><select id="catalogue-format" name="format" defaultValue={format} className={`${control} mt-2`}><option value="">All formats</option><option value="physical">Physical prints · delivered</option><option value="digital">Digital files · download</option></select></div>
            <div><Label htmlFor="catalogue-category">Category</Label><select id="catalogue-category" name="category" defaultValue={search.get("category") || ""} className={`${control} mt-2`}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><Label htmlFor="catalogue-currency">Listing currency</Label><select id="catalogue-currency" name="currency" defaultValue={search.get("currency") || ""} className={`${control} mt-2`}><option value="">All currencies</option><option value="INR">INR · Indian rupees</option><option value="USD">USD · legacy listings</option></select><p className="text-xs text-muted-foreground mt-2">No currency conversion. Price filters and price sorting use INR unless you choose USD.</p></div>
            <div><Label htmlFor="catalogue-sort">Sort by</Label><select id="catalogue-sort" name="sort" defaultValue={search.get("sort") || "featured"} className={`${control} mt-2`}><option value="featured">Featured</option><option value="newest">Newest arrivals</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div>
            <fieldset><legend className="text-sm font-medium mb-2">Price range</legend><div className="grid grid-cols-2 gap-2"><div><Label htmlFor="min-price">Minimum</Label><Input id="min-price" name="min_price" type="number" min="0" step="0.01" defaultValue={search.get("min_price") || ""} /></div><div><Label htmlFor="max-price">Maximum</Label><Input id="max-price" name="max_price" type="number" min="0" step="0.01" defaultValue={search.get("max_price") || ""} /></div></div></fieldset>
            <Button type="submit" className="w-full min-h-11">Apply filters</Button>
            <Button type="button" variant="outline" className="w-full min-h-11" onClick={() => router.push("/marketplace")}>Clear filters</Button>
          </form>
        </aside>
        <section className="flex-1 min-w-0" aria-label="Catalogue results" aria-busy={isLoading}>
          {isLoading ? <><p role="status" className="mb-5">Loading products…</p><ProductGridSkeleton count={6} /></> : isError ? <div role="alert" className="store-state"><h2>The catalogue couldn’t load.</h2><p>Please try again. Your filters have been kept.</p><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Trying again…" : "Try again"}</Button></div> : <>
            <p role="status" className="text-sm text-muted-foreground mb-6">{products.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + products.length}` : "No matching products"}{search.get("q") ? ` for “${search.get("q")}”` : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">{products.map(p => <ProductCard key={p.id} p={p} format={format} onWishlist={handleAddToWishlist} />)}</div>
            {!products.length && <div className="store-state"><h2>No products match these filters.</h2><p>Try another format, currency or category. New designs appear as creators publish them.</p></div>}
            <nav aria-label="Catalogue pages" className="flex items-center gap-4 mt-8"><Button variant="outline" onClick={() => goToPage(page - 1)} disabled={page === 1}>Previous page</Button><span className="text-sm">Page {page}</span><Button variant="outline" onClick={() => goToPage(page + 1)} disabled={!hasNext}>Next page</Button></nav>
          </>}
        </section>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return <MarketplaceShell><Suspense fallback={<div className="store-container py-8"><ProductGridSkeleton count={6} /></div>}><MarketplaceContent /></Suspense></MarketplaceShell>;
}
