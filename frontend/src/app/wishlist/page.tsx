"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Heart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ProductPrices } from "@/components/shared/product-prices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";

export default function WishlistPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();

  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/api/wishlist"),
    enabled: isAuthenticated,
  });


  if (!isAuthenticated) return null;

  const handleRemove = async (productId: number) => {
    try {
      await api.delete(`/api/wishlist/${productId}`);
      toast.success("Removed from wishlist");
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch {
      toast.error("Failed to remove from wishlist");
    }
  };

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <Heart className="text-primary" />
        My Wishlist
      </h1>

      {wishlist.length === 0 ? (
        <Card className="p-12 text-center border-border bg-card">
          <p className="text-muted-foreground mb-4">
            Your wishlist is empty.
          </p>
          <Button asChild variant="outline">
            <Link href="/marketplace">Explore the Marketplace</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {wishlist.map((item: any) => {
            const p = item.product;
            const mainImg =
              p.media?.find((m: any) => m.is_primary)?.media_url ||
              p.media?.[0]?.media_url;

            return (
              <Card
                key={item.id}
                className="p-4 flex gap-6 items-center hover:border-primary/30 transition-colors border-border bg-card shadow-sm"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-muted">
                  {mainImg ? (
                    <img
                      src={api.mediaUrl(mainImg)}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="text-xs mb-1">
                    {p.category}
                  </Badge>
                  <h3 className="font-semibold text-lg truncate font-display">
                    <Link
                      href={`/marketplace/${p.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {p.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground font-data font-semibold mt-1">
                    <ProductPrices product={p} />
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemove(p.id)}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive/30"
                >
                  <Trash2 size={18} />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <MarketplaceShell>
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 space-y-4">
          <Skeleton className="h-10 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </MarketplaceShell>
  );
}
