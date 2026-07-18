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
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";

export default function CreatorProductsPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();

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
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Package className="text-primary" />
          My Products
        </h1>
        <Button asChild>
          <Link href="/creator/products/new">
            <Plus size={18} />
            New Product
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-6 border-destructive/30 bg-destructive/5">
          <p className="text-destructive text-sm">
            {(error as any)?.detail || "Failed to load products"}
          </p>
        </Card>
      )}

      {products.length === 0 ? (
        <Card className="p-12 text-center border-border">
          <Package size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2 font-display">No products yet</h2>
          <p className="text-muted-foreground mb-6">
            Start building your portfolio by creating your first 3D model
            product.
          </p>
          <Button asChild>
            <Link href="/creator/products/new">
              <Plus size={18} />
              Create Product
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => (
            <Card
              key={product.id}
              className="p-6 hover:border-primary/30 transition-all flex flex-col h-full border-border bg-card"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold truncate flex-1 mr-2 font-display">
                  {product.title}
                </h3>
                <Badge
                  variant={
                    product.status === "published" ? "success" : "secondary"
                  }
                >
                  {product.status}
                </Badge>
              </div>
              <div className="mt-auto pt-4 flex justify-between items-center border-t border-border">
                <span className="text-lg font-bold text-primary font-data">
                  ${product.price?.toFixed(2)}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/creator/products/${product.id}`}>
                    <Edit size={14} />
                    Edit
                  </Link>
                </Button>
              </div>
            </Card>
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
