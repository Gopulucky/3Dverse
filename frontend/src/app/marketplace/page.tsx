"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { type HomepageData, type ProductCardData } from "@/lib/marketplace";
import { storeAvailability } from "@/lib/store-availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { CATEGORIES, orderCategories } from "@/lib/categories";
import { ChipRow } from "@/components/marketplace/chip-row";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";

const PAGE_SIZE = 20;
const SORTS = [["featured", "Featured"], ["newest", "Newest arrivals"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]] as const;

function MarketplaceContent() {
  const search = useSearchParams();
  const router = useRouter();
  const format = search.get("format") || "";
  const category = search.get("category") || "";
  const query = search.get("q") || "";
  const sort = search.get("sort") || "featured";
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
  const { data: shelf } = useQuery({
    queryKey: ["catalogue-categories"],
    queryFn: () => api.get<Partial<HomepageData>>("/api/marketplace/homepage"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const liveCategories = Array.isArray(shelf?.categories) ? shelf.categories.map(c => c.name).filter(Boolean) : [];
  // The chosen category stays in the row even when the shelf does not list it.
  const categoryNames = orderCategories([...(liveCategories.length ? liveCategories : CATEGORIES), category]);
  // Only once the homepage data has loaded, so a slow request never flashes "coming soon".
  const printsClosed = shelf !== undefined && !storeAvailability(shelf.availability).printed;
  const printedComingSoon = format === "physical" && printsClosed;
  const products = data.slice(0, PAGE_SIZE);
  const hasNext = data.length > PAGE_SIZE;
  const paged = page > 1 || hasNext;
  const goToPage = (next: number) => {
    const nextParams = new URLSearchParams(search.toString());
    nextParams.set("page", String(next));
    router.push(`/marketplace?${nextParams}`);
  };

  // Price order and price ranges only make sense within one currency.
  const needsCurrency = (values: { get(key: string): string | null; has(key: string): boolean }) =>
    (values.get("sort")?.startsWith("price_") ?? false) || values.has("min_price") || values.has("max_price");
  // Every change of choice goes through here: back to page 1, and the currency added for
  // price order is dropped again with it, so nothing stays filtered out of sight.
  const hrefWith = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search.toString());
    change(next);
    next.delete("page");
    if (needsCurrency(next)) {
      if (!next.has("currency")) next.set("currency", "INR");
    } else if (needsCurrency(search)) next.delete("currency");
    const text = next.toString();
    return text ? `/marketplace?${text}` : "/marketplace";
  };
  const go = (change: (next: URLSearchParams) => void) => router.push(hrefWith(change), { scroll: false });
  const choose = (key: string, value: string) => hrefWith(next => { if (value) next.set(key, value); else next.delete(key); });

  // Category and type show their own state in the rows above; these cover what has no row.
  const chips: { key: string; label: string; clear: (next: URLSearchParams) => void }[] = [];
  if (query) chips.push({ key: "q", label: `Search: “${query}”`, clear: next => next.delete("q") });
  if (search.get("min_price") || search.get("max_price")) chips.push({ key: "price", label: `Price ${search.get("min_price") || "0"} to ${search.get("max_price") || "any"}`, clear: next => { next.delete("min_price"); next.delete("max_price"); } });
  if (search.get("currency") && !needsCurrency(search)) chips.push({ key: "currency", label: `Priced in ${search.get("currency")}`, clear: next => next.delete("currency") });

  const title = format === "physical" ? "Printed products" : format === "digital" ? "Digital models" : "Explore 3D creations";
  const lead = format === "physical" ? "Finished 3D prints, made and shipped to you."
    : format === "digital" ? "Model files for your own 3D printer. No physical item is sent."
    // Do not advertise finished prints while they cannot be ordered.
    : printsClosed ? "Discover digital models. Finished 3D prints are coming soon."
    : "Discover digital models and beautifully crafted 3D prints.";
  const count = !products.length ? "No matching products"
    : paged ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + products.length}`
    : `${products.length} ${products.length === 1 ? "product" : "products"}`;

  return (
    <div className="store-container catalogue">
      <header className="catalogue-head">
        <h1 className="display">{title}</h1>
        <p>{lead}</p>
      </header>

      {/* Phones have no search field in the header, so the catalogue carries it. */}
      <form role="search" aria-label="Quick catalogue search" className="md:hidden mb-3" onSubmit={event => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get("q") || "").trim();
        go(next => { if (q) next.set("q", q); else next.delete("q"); });
      }}>
        <Input key={query} name="q" type="search" aria-label="Search catalogue" defaultValue={query} placeholder="Search 3D models and prints" className="min-h-11" />
      </form>

      <ChipRow label="Shop by category" keepScroll items={[
        { label: "All", href: choose("category", ""), current: !category },
        ...categoryNames.map(name => ({ label: name, href: choose("category", name), current: category === name })),
      ]} />
      <ChipRow label="Product type" variant="tabs" keepScroll items={[
        { label: "All", href: choose("format", ""), current: !format },
        { label: "Digital models", href: choose("format", "digital"), current: format === "digital" },
        { label: "Printed products", href: choose("format", "physical"), current: format === "physical" },
      ]} />

      <section aria-label="Catalogue results" aria-busy={isLoading}>
        <div className="catalogue-controls">
          <p role="status">{isLoading ? "Loading products…" : isError ? "" : `${count}${query ? ` for “${query}”` : ""}`}</p>
          <label className="catalogue-sort">
            <span aria-hidden="true">Sort by</span>
            <select aria-label="Sort products" value={sort} onChange={event => go(next => { next.set("sort", event.target.value); })}>
              {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {chips.length > 0 && <div role="group" aria-label="Applied filters" className="mb-4 flex flex-wrap gap-2">
          {chips.map(chip => <button key={chip.key} type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => go(chip.clear)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ember-ink/30 bg-ember-surface px-3 text-sm font-medium text-ember-ink hover:border-ember-ink">{chip.label}<X size={14} aria-hidden="true" /></button>)}
        </div>}
        {isLoading ? <ProductGridSkeleton count={8} /> : isError ? <div role="alert" className="store-state"><h2>The catalogue couldn’t load.</h2><p>Please try again. Your choices have been kept.</p><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Trying again…" : "Try again"}</Button></div> : <>
          <div className="catalogue-grid">{products.map(p => <ProductCard key={p.id} p={p} format={format} />)}</div>
          {!products.length && (printedComingSoon
            ? <div className="store-state" data-state="printed-coming-soon"><h2>Printed products are coming soon.</h2><p>We are still setting up printing and delivery, so finished prints can’t be ordered yet. Digital model files are available now.</p><div className="flex flex-wrap gap-x-6"><Link href="/#waitlist" className="market-text-link">Get notified at launch</Link><Link href="/marketplace?format=digital" className="market-text-link">Browse digital models</Link></div></div>
            : <div className="store-state"><h2>No products match these filters.</h2><p>Try another category or product type. New designs appear as creators publish them.</p><Link href="/marketplace" className="market-text-link">Show all products</Link></div>)}
          {paged && <nav aria-label="Catalogue pages" className="flex items-center justify-center gap-4 mt-10"><Button variant="outline" onClick={() => goToPage(page - 1)} disabled={page === 1}>Previous page</Button><span className="text-sm">Page {page}</span><Button variant="outline" onClick={() => goToPage(page + 1)} disabled={!hasNext}>Next page</Button></nav>}
        </>}
      </section>
    </div>
  );
}

export default function MarketplacePage() {
  return <MarketplaceShell><Suspense fallback={<div className="store-container py-8"><ProductGridSkeleton count={8} /></div>}><MarketplaceContent /></Suspense></MarketplaceShell>;
}
