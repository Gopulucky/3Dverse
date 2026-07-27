"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Star, Tag, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";

function ProductSection({
  title,
  icon: Icon,
  iconColor,
  products,
}: {
  title: string;
  icon: any;
  iconColor: string;
  products: any[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.8
          : scrollLeft + clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="mb-20">
      <div className="flex justify-between items-end mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 font-display">
          <Icon className={iconColor} size={24} />
          {title}
        </h2>
      </div>
      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 z-10 bg-background/90 hover:bg-background backdrop-blur-md shadow-lg border border-border rounded-full w-12 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
        >
          <ChevronLeft size={24} />
        </button>
        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 px-1 -mx-1 snap-x snap-mandatory no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((p: any) => (
            <div key={p.id} className="min-w-[280px] w-[280px] sm:min-w-[320px] sm:w-[320px] shrink-0 snap-start">
              <ProductCard p={p} />
            </div>
          ))}
        </div>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 z-10 bg-background/90 hover:bg-background backdrop-blur-md shadow-lg border border-border rounded-full w-12 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
}

export default function MarketplaceHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["homepage"],
    queryFn: () => api.get<any>("/api/marketplace/homepage"),
  });

  return (
    <MarketplaceShell>
      <div className="min-h-screen">
        {/* Hero Section (Carousel) */}
        <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden bg-muted group">
          <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-0%)` }}>
            <div className="w-full h-full flex-shrink-0 relative bg-gradient-to-r from-primary/90 to-primary/80 text-primary-foreground flex items-center">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-30"></div>
              <div className="max-w-7xl mx-auto px-12 relative z-10">
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4 font-display">
                  The Future of <br/> 3D Printing
                </h1>
                <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-lg">
                  Explore thousands of premium, ready-to-print models from world-class creators.
                </p>
                <Button size="lg" className="bg-card text-primary hover:bg-card/90 font-bold rounded-full px-8">
                  Shop Now
                </Button>
              </div>
            </div>
          </div>
          {/* Carousel Controls (Mock) */}
          <button className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-16 bg-ink/20 hover:bg-card/20 backdrop-blur flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100 text-primary-foreground">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-16 bg-ink/20 hover:bg-card/20 backdrop-blur flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100 text-primary-foreground">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </section>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          {isLoading ? (
            <div className="space-y-16">
              <div>
                <div className="h-8 w-48 skeleton rounded mb-8" />
                <ProductGridSkeleton count={4} />
              </div>
              <div>
                <div className="h-8 w-48 skeleton rounded mb-8" />
                <ProductGridSkeleton count={4} />
              </div>
            </div>
          ) : (
            <>
              <ProductSection
                title="Featured Products"
                icon={Star}
                iconColor="text-ember"
                products={data?.featured || []}
              />

              <ProductSection
                title="Trending Now"
                icon={Tag}
                iconColor="text-primary"
                products={data?.trending || []}
              />

              <ProductSection
                title="New Arrivals"
                icon={Clock}
                iconColor="text-primary"
                products={data?.new_arrivals || []}
              />

              {/* Categories */}
              {data?.categories && data.categories.length > 0 && (
                <section className="mt-16">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center font-display">
                    Shop by Category
                  </h2>
                  <div className="flex flex-wrap justify-center gap-3">
                    {data.categories.map((c: string) => (
                      <Link
                        key={c}
                        href={`/marketplace?category=${encodeURIComponent(c)}`}
                      >
                        <Button variant="outline" className="rounded-full px-6">
                          {c}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </MarketplaceShell>
  );
}
