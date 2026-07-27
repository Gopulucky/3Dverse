"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Wand2, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreatorListing {
  id: number;
  name: string;
  creator_type: string | null;
  creator_tier: string | null;
  bio: string | null;
  avatar_url: string | null;
  specializations: string[];
  portfolio_images: string[];
  published_products: number;
  response_time_hours: number | null;
}

const TIER_LABEL: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export default function BrowseCreatorsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [creators, setCreators] = useState<CreatorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const fetchCreators = (query?: string) => {
    setLoading(true);
    api
      .get<CreatorListing[]>("/api/custom-designs/creators", query ? { q: query } : undefined)
      .then(setCreators)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (ready) fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  return (
    <MarketplaceShell>
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Wand2 className="text-primary" />
            Commission a Custom Design
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Describe what you want, pick a creator, and get a one-of-a-kind design made just for
            you — negotiate the price directly with them before any work starts.
          </p>
        </div>

        <div className="flex gap-2 mb-8 max-w-md">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCreators(q)}
            placeholder="Search creators by name or bio…"
            className="flex-1 h-10 px-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button variant="outline" onClick={() => fetchCreators(q)}>
            <Search size={16} />
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading creators…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((c) => (
              <Card key={c.id} className="p-6 flex flex-col hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {c.avatar_url ? (
                      <img
                        src={api.mediaUrl(c.avatar_url)}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      c.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold font-display truncate">{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {c.creator_type && (
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {c.creator_type}
                        </Badge>
                      )}
                      {c.creator_tier && (
                        <span className="flex items-center gap-0.5 text-[10px] text-ember font-semibold">
                          <Star size={10} className="fill-current" />
                          {TIER_LABEL[c.creator_tier] || c.creator_tier}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-grow">
                  {c.bio || "No bio yet."}
                </p>

                {c.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.specializations.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-muted text-muted-foreground text-[11px] rounded-md"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {c.portfolio_images.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {c.portfolio_images.map((img, i) => (
                      <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <img
                          src={api.mediaUrl(img)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  {c.published_products} published design{c.published_products === 1 ? "" : "s"}
                </p>

                <Button
                  className="w-full"
                  onClick={() =>
                    router.push(
                      `/commissions/new?creatorId=${c.id}&creatorName=${encodeURIComponent(c.name)}`
                    )
                  }
                >
                  Request Custom Design
                </Button>
              </Card>
            ))}

            {creators.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                No creators found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </MarketplaceShell>
  );
}
