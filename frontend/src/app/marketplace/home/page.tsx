"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Star, Tag, Clock, Search } from "lucide-react";
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
  if (!products || products.length === 0) return null;

  return (
    <section className="mb-20">
      <div className="flex justify-between items-end mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 font-display">
          <Icon className={iconColor} size={24} />
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((p: any) => (
          <ProductCard key={p.id} p={p} />
        ))}
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
        {/* Hero Section */}
        <section className="relative py-24 overflow-hidden border-b border-border bg-card/40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(110,91,255,0.08),transparent_60%)]" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 font-display">
                Discover{" "}
                <span className="text-gradient-primary">Extraordinary</span>
                <br />
                3D Creations
              </h1>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                The premium marketplace for digital downloads, physical prints,
                and customizable 3D merchandise.
              </p>

              {/* Search bar */}
              <div className="relative max-w-xl mx-auto">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={20}
                />
                <Link href="/marketplace">
                  <div className="w-full rounded-full border border-border bg-card pl-12 pr-6 py-4 text-left text-muted-foreground hover:border-primary/30 transition-colors cursor-pointer shadow-sm">
                    Search models, categories, creators...
                  </div>
                </Link>
              </div>
            </div>
          </div>
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
                iconColor="text-nozzle-orange"
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
