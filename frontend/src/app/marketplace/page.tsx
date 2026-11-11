"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownUp, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import { type ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";

const CATEGORIES = ["Tabletop", "Jewelry", "Cosplay", "Miniatures", "Home Decor", "Gadgets", "Architecture", "Engineering", "Medical", "Gaming"];
const PAGE_SIZE = 20;
const SORTS = [["featured", "Featured"], ["newest", "Newest arrivals"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]] as const;

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Escape closes whichever sheet is open, wherever focus is.
  useEffect(() => {
    if (!sortOpen && !filtersOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSortOpen(false); setFiltersOpen(false); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [sortOpen, filtersOpen]);
  const sort = search.get("sort") || "featured";
  const sortLabel = SORTS.find(([value]) => value === sort)?.[1] ?? "Featured";
  // Every change goes through here: back to page 1, and price filters need an explicit currency.
  const go = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search.toString());
    change(next);
    next.delete("page");
    if ((next.get("sort")?.startsWith("price_") || next.has("min_price") || next.has("max_price")) && !next.has("currency")) next.set("currency", "INR");
    router.push(`/marketplace?${next}`);
  };
  const chips: { key: string; label: string; clear: (next: URLSearchParams) => void }[] = [];
  if (format) chips.push({ key: "format", label: format === "physical" ? "Printed products" : "Digital models", clear: next => next.delete("format") });
  if (search.get("category")) chips.push({ key: "category", label: search.get("category") as string, clear: next => next.delete("category") });
  if (search.get("min_price") || search.get("max_price")) chips.push({ key: "price", label: `Price ${search.get("min_price") || "0"} to ${search.get("max_price") || "any"}`, clear: next => { next.delete("min_price"); next.delete("max_price"); } });
  return (
    <div className="store-container py-4 md:py-8 pb-20">
      <header className="mb-3 md:mb-8 max-w-3xl">
        <h1 className="text-xl sm:text-4xl font-display font-semibold mb-1 md:mb-3">{format === "physical" ? "Printed products" : format === "digital" ? "Digital models" : "Shop 3D models and prints"}</h1>
        <p className="hidden md:block text-muted-foreground">{format === "physical" ? "Finished 3D prints made and shipped to you. No printer needed. Check each listing for available options." : format === "digital" ? "Downloadable model files for your own 3D printer. These purchases do not include a physical product." : "Choose a delivered physical product or a digital model file for your own printer. Each listing offers its own formats."}</p>
      </header>
      <div className="md:hidden sticky top-16 z-20 -mx-4 mb-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <form role="search" aria-label="Quick catalogue search" className="mb-2" onSubmit={event => {
          event.preventDefault();
          const q = String(new FormData(event.currentTarget).get("q") || "").trim();
          go(next => { if (q) next.set("q", q); else next.delete("q"); });
        }}>
          <Input key={search.get("q") || ""} name="q" type="search" aria-label="Search catalogue" defaultValue={search.get("q") || ""} placeholder="Search 3D models and prints" className="min-h-11" />
        </form>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="min-h-11 justify-center gap-2 truncate" aria-haspopup="dialog" onClick={() => setSortOpen(true)}>
            <ArrowDownUp size={16} aria-hidden="true" />{sort === "featured" ? "Sort" : `Sort: ${sortLabel}`}
          </Button>
          <Button type="button" variant="outline" className="min-h-11 justify-center gap-2" aria-controls="catalogue-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} aria-hidden="true" />{chips.length ? `Filters (${chips.length})` : "Filters"}
          </Button>
        </div>
      </div>
      {sortOpen && <div className="md:hidden fixed inset-0 z-50">
        <button type="button" aria-label="Close sort options" className="absolute inset-0 bg-black/40" onClick={() => setSortOpen(false)} />
        <div role="dialog" aria-modal="true" aria-label="Sort" className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-background p-4 pb-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Sort by</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={() => setSortOpen(false)}><X size={20} aria-hidden="true" /></Button>
          </div>
          <div role="radiogroup" aria-label="Sort products" className="divide-y divide-border">
            {SORTS.map(([value, label]) => <label key={value} className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
              <span>{label}</span>
              <input type="radio" name="sort-sheet" value={value} aria-label={label} checked={sort === value} className="h-5 w-5 accent-[var(--store-action)]" onChange={() => { setSortOpen(false); go(next => { next.set("sort", value); }); }} />
            </label>)}
          </div>
        </div>
      </div>}
      {chips.length > 0 && <div role="group" aria-label="Applied filters" className="mb-3 flex flex-wrap gap-2">
        {chips.map(chip => <button key={chip.key} type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => go(chip.clear)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-sm font-medium hover:border-foreground">{chip.label}<X size={14} aria-hidden="true" /></button>)}
      </div>}
      <div className="flex flex-col md:flex-row gap-8">
        <aside id="catalogue-filters" className={cn("md:w-56 shrink-0", filtersOpen ? "fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-background p-4 md:static md:z-auto md:overflow-visible md:p-0" : "hidden md:block")}>
          {filtersOpen && <div className="mb-4 flex items-center justify-between md:hidden">
            <h2 className="font-display text-lg font-semibold">Filters</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={20} aria-hidden="true" /></Button>
          </div>}
          <form key={search.toString()} className="space-y-5" aria-label="Catalogue filters" onSubmit={event => {
            event.preventDefault();
            setFiltersOpen(false);
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
            <p role="status" className="text-sm text-muted-foreground mb-3 md:mb-6">{products.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + products.length}` : "No matching products"}{search.get("q") ? ` for “${search.get("q")}”` : ""}</p>
            <div className="catalogue-grid grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">{products.map(p => <ProductCard key={p.id} p={p} format={format} onWishlist={handleAddToWishlist} />)}</div>
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
