"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { productImage, type HomepageData, type ProductCardData } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/shared/product-card";
import { ProductImage } from "@/components/shared/product-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <section className="store-section" aria-labelledby={titleId}>
      <div className="store-container">
        <div className="store-section-head">
          <h2 id={titleId}>{title}</h2>
          <div className="store-rail-actions">
            <Link href="/marketplace" className="market-text-link">Browse all models</Link>
            {rail && <>
              <Button type="button" variant="ghost" size="icon" aria-label={`Previous ${title.toLowerCase()}`} disabled={!edges.left} onClick={() => scroll("left")}><ChevronLeft size={20} aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Next ${title.toLowerCase()}`} disabled={!edges.right} onClick={() => scroll("right")}><ChevronRight size={20} aria-hidden="true" /></Button>
            </>}
          </div>
        </div>
        <div ref={scrollRef} className={rail ? "store-rail" : "store-grid"} tabIndex={rail ? 0 : undefined}
          role={rail ? "region" : undefined} aria-label={rail ? `${title}, scroll to explore` : undefined} onScroll={rail ? updateEdges : undefined}>
          {products.map(product => <ProductCard key={product.id} p={product} />)}
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
  const featured = data?.featured ?? [];
  const trending = data?.trending ?? [];
  const arrivals = data?.new_arrivals ?? [];
  const categories = data?.categories ?? [];
  const creators = data?.popular_creators ?? [];
  const heroProduct = [...featured, ...trending, ...arrivals].find(product => productImage(product));
  const empty = !featured.length && !trending.length && !arrivals.length;

  const retryButton = <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching} aria-busy={isFetching}>
    {isFetching && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
    {isFetching ? "Trying again…" : "Try again"}
  </Button>;

  return (
    <div className="storefront">
      <HomeHero product={heroProduct} />
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
                  <Link href="/creator/products/new" className="market-text-link">Publish a design</Link>
                </div>
              </section>
            ) : <ProductSection title="Featured models" products={featured} />}

            {categories.length > 0 && <section className="store-categories" aria-labelledby="category-title">
              <div className="store-container">
                <div className="store-section-head"><h2 id="category-title">Explore categories</h2></div>
                <div className="store-category-list">
                  {categories.map(category => <Link key={category.name} href={`/marketplace?category=${encodeURIComponent(category.name)}`} className="store-category">
                    <span>{category.name}</span><ArrowUpRight size={20} aria-hidden="true" />
                  </Link>)}
                </div>
              </div>
            </section>}

            <ProductSection title="Trending" products={trending} rail />

            {arrivals.length > 0 && <section className="store-section store-container" aria-labelledby="arrivals-title">
              <div className="store-arrivals">
                <div className="store-section-head">
                  <h2 id="arrivals-title">New arrivals</h2>
                  <Link href="/marketplace" className="market-text-link">Browse all models</Link>
                </div>
                <div>
                  {arrivals.map(product => <Link key={product.id} href={`/marketplace/${product.id}`} className="store-arrival">
                    <span className="store-arrival-image"><ProductImage src={productImage(product)} title={product.title} /></span>
                    <div><h3>{product.title}</h3>{product.creator_name && <p>By {product.creator_name}</p>}</div>
                    {product.price != null && <span className="market-price">${product.price.toFixed(2)}</span>}
                  </Link>)}
                </div>
              </div>
            </section>}

            {creators.length > 0 && <section className="store-creators" aria-labelledby="creators-title">
              <div className="store-container store-creators-layout">
                <h2 id="creators-title">Popular creators</h2>
                <ul className="store-creator-list">
                  {creators.map((creator, index) => <li key={`${creator.name}-${index}`} className="store-creator">
                    <Avatar className="h-12 w-12">
                      {creator.image && <AvatarImage src={api.mediaUrl(creator.image)} alt="" />}
                      <AvatarFallback>{creator.initials}</AvatarFallback>
                    </Avatar>
                    <div><h3>{creator.name}</h3><p>{creator.role}</p></div>
                  </li>)}
                </ul>
              </div>
            </section>}
          </>
        )}
      </div>
    </div>
  );
}
