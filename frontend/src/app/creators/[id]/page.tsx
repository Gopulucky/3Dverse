"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ProductCardData } from "@/lib/marketplace";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { ProductCard } from "@/components/shared/product-card";
import { FollowButton } from "@/components/creator/follow-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface Creator {
  id: number;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
  member_since?: string | null;
  product_count: number;
  follower_count: number;
}

/** A creator's public page: who they are, a Follow button, and every design they have published. */
export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const creatorId = Number(params.id);
  const valid = Number.isInteger(creatorId) && creatorId > 0;

  const profile = useQuery({
    queryKey: ["creator", creatorId],
    queryFn: () => api.get<Creator>(`/api/creators/${creatorId}`),
    enabled: valid,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const products = useQuery({
    queryKey: ["creator", creatorId, "products"],
    queryFn: () => api.get<ProductCardData[]>(`/api/creators/${creatorId}/products`),
    enabled: valid && profile.isSuccess,
  });

  const creator = profile.data;

  return (
    <MarketplaceShell>
      <div className="store-container pt-8 pb-24" data-flow="creator-page" data-state={profile.isLoading ? "loading" : creator ? "ready" : "missing"}>
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 pt-4">
          <Link href="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-foreground font-semibold">{creator?.name ?? "Creator"}</span>
        </nav>

        {!valid || profile.isError ? (
          <div className="py-24 text-center">
            <h1 className="text-2xl font-bold font-display mb-2">This creator page isn&apos;t available.</h1>
            <p className="text-muted-foreground mb-6">They may not have published a design yet, or the link is wrong.</p>
            <Link href="/marketplace" className="underline text-primary-ink">Browse the marketplace</Link>
          </div>
        ) : profile.isLoading || !creator ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-80" />
            <Skeleton className="h-6 w-96 max-w-full" />
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-12 pb-10 border-b border-border">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border border-border">
                  <AvatarFallback className="bg-primary-surface text-primary-ink text-2xl font-semibold">
                    {creator.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight font-display leading-tight">{creator.name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground font-data">
                    {creator.product_count} {creator.product_count === 1 ? "design" : "designs"} ·{" "}
                    <span data-testid="follower-count">{creator.follower_count}</span>{" "}
                    {creator.follower_count === 1 ? "follower" : "followers"}
                    {creator.member_since ? ` · Joined ${formatDate(creator.member_since)}` : ""}
                  </p>
                  {creator.bio && <p className="mt-2 max-w-2xl text-sm text-muted-foreground whitespace-pre-line">{creator.bio}</p>}
                </div>
              </div>
              <FollowButton creatorId={creator.id} creatorName={creator.name} next={`/creators/${creator.id}`} />
            </header>

            <h2 className="text-xl font-semibold font-display mb-6">All designs by {creator.name}</h2>
            {products.isLoading ? (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
                {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="aspect-square rounded-xl" />)}
              </div>
            ) : products.isError ? (
              <p role="alert" className="text-sm text-destructive">The designs couldn&apos;t load. Refresh to try again.</p>
            ) : (
              <div className="catalogue-grid grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
                {(products.data ?? []).map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </div>
    </MarketplaceShell>
  );
}
