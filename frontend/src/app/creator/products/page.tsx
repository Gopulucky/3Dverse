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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
          <Package className="text-primary" />
          My Products
        </h1>
        <Button asChild className="rounded-sm font-semibold">
          <Link href="/creator/products/new">
            <Plus size={18} className="mr-2" />
            New Product
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-4 mb-6 border border-destructive/30 bg-destructive/5 rounded-sm">
          <p className="text-destructive text-sm font-medium">
            {(error as any)?.detail || "Failed to load products"}
          </p>
        </div>
      )}

      {products.length === 0 ? (
        <div className="p-12 text-center border border-border rounded-sm bg-card">
          <Package size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2 font-display">No products yet</h2>
          <p className="text-muted-foreground mb-6">
            Start building your portfolio by creating your first 3D model product.
          </p>
          <Button asChild className="rounded-sm">
            <Link href="/creator/products/new">
              <Plus size={18} className="mr-2" />
              Create Product
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-sm bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: any) => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground max-w-[300px] truncate">
                    {product.title}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={product.status === "published" ? "success" : "secondary"}
                      className="rounded-sm text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                    >
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-data font-bold text-[15px]">
                    ${product.price?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold px-3 rounded-sm" asChild>
                      <Link href={`/creator/products/${product.id}`}>
                        <Edit size={14} className="mr-1.5" /> Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
