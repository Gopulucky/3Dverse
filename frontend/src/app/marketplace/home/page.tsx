"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Star, Tag, Clock, Search, ChevronLeft, ChevronRight, Users, LayoutGrid } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";



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
          <Icon className={iconColor} size={28} />
          {title}
        </h2>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">View All</Button>
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
      <div className="min-h-screen pb-20">
        {/* Hero Section (Carousel) */}
        <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden bg-muted group mb-12">
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
                <Button size="lg" className="bg-card text-primary hover:bg-card/90 font-bold rounded-full px-8 shadow-lg hover:scale-105 transition-transform">
                  Shop Now
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="space-y-16">
              <div>
                <div className="h-8 w-48 skeleton rounded mb-8" />
                <ProductGridSkeleton count={5} />
              </div>
              <div>
                <div className="h-8 w-48 skeleton rounded mb-8" />
                <ProductGridSkeleton count={5} />
              </div>
            </div>
          ) : (
            <>
              {/* Main Product Rows */}
              <ProductSection
                title="Featured Models"
                icon={Star}
                iconColor="text-amber-500"
                products={data?.featured || []}
              />

              <ProductSection
                title="Trending"
                icon={Tag}
                iconColor="text-primary"
                products={data?.trending || []}
              />

              <ProductSection
                title="New Arrivals"
                icon={Clock}
                iconColor="text-emerald-500"
                products={data?.new_arrivals || []}
              />

              {/* Popular Creators */}
              <section className="mb-20">
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 font-display">
                    <Users className="text-blue-500" size={28} />
                    Popular Creators
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                  {(data?.popular_creators || []).map((creator: any, i: number) => (
                    <Card key={i} className="p-6 text-center hover:shadow-md transition-all group hover:-translate-y-1 bg-card/50 backdrop-blur">
                      <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary/20 group-hover:border-primary transition-colors">
                        {creator.image && <AvatarImage src={api.mediaUrl(creator.image)} />}
                        <AvatarFallback>{creator.initials}</AvatarFallback>
                      </Avatar>
                      <h3 className="font-bold font-display text-lg mb-1">{creator.name}</h3>
                      <p className="text-muted-foreground text-sm font-medium mb-3">{creator.role}</p>
                      <Button variant="outline" size="sm" className="w-full rounded-full">Follow</Button>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Categories Banner Grid */}
              <section className="mb-20">
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 font-display">
                    <LayoutGrid className="text-purple-500" size={28} />
                    Explore Categories
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(data?.categories || []).map((category: any, i: number) => (
                    <Link key={i} href={`/marketplace?category=${encodeURIComponent(category.name)}`}>
                      <div className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer">
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10" />
                        <img 
                          src={category.image} 
                          alt={category.name} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                          <h3 className="text-2xl font-bold text-white font-display drop-shadow-md">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

            </>
          )}
        </div>
      </div>
    </MarketplaceShell>
  );
}
