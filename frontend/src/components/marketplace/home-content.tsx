"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, Package, ShieldCheck, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { homeSections } from "@/lib/home-sections";
import type { HomepageData, ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/shared/product-card";

function ProductSection({ title, products, rail = false }: { title: string; products: ProductCardData[]; rail?: boolean }) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = () => {
    const element = scrollRef.current;
    if (element) setEdges({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
  };

  useEffect(() => {
    if (!rail || !scrollRef.current) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scrollRef.current);
    const frame = requestAnimationFrame(updateEdges);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [rail, products.length]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      left: element.clientWidth * 0.8 * (direction === "left" ? -1 : 1),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  if (!products.length) return null;
  return (
    <section className="store-section home-products" aria-labelledby={titleId}>
      <div className="store-container">
        <div className="store-section-head">
          <h2 id={titleId}>{title}</h2>
          <div className="store-rail-actions">
            <Link href="/marketplace" className="market-text-link">Browse all products</Link>
            {rail && <>
              <Button type="button" variant="ghost" size="icon" aria-label={`Previous ${title.toLowerCase()}`} disabled={!edges.left} onClick={() => scroll("left")}><ChevronLeft size={20} aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Next ${title.toLowerCase()}`} disabled={!edges.right} onClick={() => scroll("right")}><ChevronRight size={20} aria-hidden="true" /></Button>
            </>}
          </div>
        </div>
        <div ref={scrollRef} className={rail ? "store-rail store-rail--compact" : "store-grid store-grid--compact"} tabIndex={rail ? 0 : undefined}
          role={rail ? "region" : undefined} aria-label={rail ? `${title}, scroll to explore` : undefined} onScroll={rail ? updateEdges : undefined}>
          {products.map(product => <ProductCard key={product.id} p={product} compact />)}
        </div>
      </div>
    </section>
  );
}

/** Shared by / and /marketplace/home; catalogue records stay server-prefetched. */
export function MarketplaceHomeContent({ initialData }: { initialData?: HomepageData }) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["homepage"],
    queryFn: () => api.get<HomepageData>("/api/marketplace/homepage"),
    initialData,
    // The API client already retries transient failures. Avoid doubling that wait.
    retry: false,
  });
  const categories = data?.categories ?? [];
  const { primary, second, empty } = homeSections({
    new_arrivals: data?.new_arrivals, featured: data?.featured, trending: data?.trending,
  });

  const retryButton = <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching} aria-busy={isFetching}>
    {isFetching && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
    {isFetching ? "Trying again…" : "Try again"}
  </Button>;

  return (
    <div className="storefront">
      {categories.length > 0 && <nav className="home-chips" aria-label="Shop by category">
        <div className="store-container home-chips-list">
          {categories.map(category => <Link key={category.name} href={`/marketplace?category=${encodeURIComponent(category.name)}`} className="home-chip">{category.name}</Link>)}
        </div>
      </nav>}

      <section className="store-container home-intro" aria-labelledby="home-title">
        <h1 id="home-title">3D models and finished prints</h1>
        <div className="home-tiles">
          <Link href="/marketplace?format=physical" className="home-tile home-tile--printed">
            <Package size={36} aria-hidden="true" />
            <span><strong>Printed products</strong><small>Delivered in India</small></span>
          </Link>
          <Link href="/marketplace?format=digital" className="home-tile home-tile--digital">
            <Download size={36} aria-hidden="true" />
            <span><strong>Digital models</strong><small>Files for your 3D printer</small></span>
          </Link>
        </div>
      </section>

      <div id="featured" className="scroll-mt-20">
        {isLoading ? (
          <section className="store-section store-container" aria-label="Loading models" aria-busy="true">
            <p role="status" className="mb-6 text-muted-foreground">Loading the catalogue…</p>
            <ProductGridSkeleton count={4} />
          </section>
        ) : isError && !data ? (
          <section className="store-container" aria-labelledby="catalogue-error">
            <div className="store-state" role="alert">
              <h2 id="catalogue-error">The catalogue couldn’t load.</h2>
              <p>Please try again in a moment.</p>
              {retryButton}
            </div>
          </section>
        ) : (
          <>
            {isError && <div className="store-container"><div className="store-refresh" role="status"><p>Couldn’t refresh the catalogue. Showing the last available models.</p>{retryButton}</div></div>}
            {empty ? (
              <section className="store-container" aria-labelledby="catalogue-empty">
                <div className="store-state">
                  <h2 id="catalogue-empty">No models yet.</h2>
                  <p>New designs will appear here as creators publish them.</p>
                  <Link href="/marketplace" className="market-text-link">Browse the catalogue</Link>
                </div>
              </section>
            ) : <ProductSection title={primary.title} products={primary.products} />}
            <ProductSection title={second.title} products={second.products} rail />
          </>
        )}
      </div>

      <section className="home-trust" aria-label="Shopping with 3DVerse">
        <ul className="store-container">
          <li><Truck size={20} aria-hidden="true" />Delivery within India</li>
          <li><Download size={20} aria-hidden="true" />Digital files unlock after payment</li>
          <li><ShieldCheck size={20} aria-hidden="true" />Secure payment</li>
        </ul>
      </section>
    </div>
  );
}
