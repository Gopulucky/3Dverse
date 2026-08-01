"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Package, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireRole } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";

import { CreatorProductCard } from "@/components/shared/creator-product-card";

export default function CreatorProductsPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireRole(["creator", "admin"]);

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["creator-products"],
    queryFn: () => api.get<any[]>("/api/products/creator"),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const content = (
    <div className="w-full px-6 pt-8 pb-12">
      <div className="flex justify-between items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Package className="text-ember" />
            My Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your models, pricing, and inventory.</p>
        </div>
        <Button asChild className="rounded-xl px-6 font-semibold shadow-lg hover-lift">
          <Link href="/creator/products/new">
            <Plus size={18} className="mr-2" />
            New Product
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-4 mb-6 border border-destructive/30 bg-destructive/5 rounded-xl">
          <p className="text-destructive text-sm font-medium">
            {(error as any)?.detail || "Failed to load products"}
          </p>
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-[80px] mb-6 leading-none">📦</div>
          <h2 className="text-2xl font-bold font-display mb-2 text-foreground">No products yet.</h2>
          <p className="text-muted-foreground mb-8 text-lg max-w-sm mx-auto">
            Start building your portfolio by creating your first printable model.
          </p>
          <Button asChild size="lg" className="rounded-xl px-12 shadow-lg hover-lift group">
            <Link href="/creator/products/new">
              <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform" />
              Upload Model
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {products.map((product: any) => (
            <CreatorProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
