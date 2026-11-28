"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, ShieldCheck, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { homeSections } from "@/lib/home-sections";
import { orderCategories } from "@/lib/categories";
import { storeAvailability, trustItems } from "@/lib/store-availability";
import type { HomepageData, ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/shared/product-card";
import { ChipRow } from "@/components/marketplace/chip-row";
import { HomeSupport } from "@/components/marketplace/home-support";
import { HomeHero } from "@/components/marketplace/home-hero";

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
        <div ref={scrollRef} className={rail ? "home-rail" : "catalogue-grid home-grid"} tabIndex={rail ? 0 : undefined}
          role={rail ? "region" : undefined} aria-label={rail ? `${title}, scroll to explore` : undefined} onScroll={rail ? updateEdges : undefined}>
          {products.map(product => <ProductCard key={product.id} p={product} />)}
        </div>
      </div>
    </section>
  );
}

/** Shared by / and /marketplace/home; catalogue records stay server-prefetched. */
export function MarketplaceHomeContent({ initialData, supportOpen = false }: { initialData?: HomepageData; supportOpen?: boolean }) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["homepage"],
    queryFn: () => api.get<HomepageData>("/api/marketplace/homepage"),
    initialData,
    // The API client already retries transient failures. Avoid doubling that wait.
    retry: false,
  });
  const categories = data?.categories ?? [];
  const availability = storeAvailability(data?.availability);
  const trustIcons = { delivery: Truck, downloads: Download, payment: ShieldCheck } as const;
  const { primary, second, empty } = homeSections({
    new_arrivals: data?.new_arrivals, featured: data?.featured, trending: data?.trending,
  });

  const retryButton = <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching} aria-busy={isFetching}>
    {isFetching && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
    {isFetching ? "Trying again…" : "Try again"}
  </Button>;

  return (
    <div className="storefront">
      {categories.length > 0 && <div className="store-container home-categories">
        <ChipRow label="Shop by category" items={[
          { label: "All", href: "/marketplace" },
          ...orderCategories(categories.map(category => category.name)).map(name => ({ label: name, href: `/marketplace?category=${encodeURIComponent(name)}` })),
        ]} />
      </div>}

      <HomeHero availability={availability} />

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

      {supportOpen && <HomeSupport />}

      <section className="home-trust" aria-label="Shopping with buy&sell3d">
        <div className="store-container">
          <ul>
            {trustItems(availability).map(({ key, label }) => {
              const Icon = trustIcons[key];
              return <li key={key} data-trust={key}><Icon size={20} aria-hidden="true" />{label}</li>;
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
