"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, Download, Printer, Wand2, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export interface ProductCardData {
  id: number;
  title: string;
  category?: string;
  price?: number;
  avg_rating?: number | null;
  review_count?: number;
  creator_name?: string | null;
  is_featured?: boolean;
  is_mode_2_active?: boolean;
  is_mode_3_active?: boolean;
  is_mode_4_active?: boolean;
  media?: { media_url: string; is_primary?: boolean }[];
}

export function ProductCard({
  p,
  onWishlist,
  className,
}: {
  p: ProductCardData;
  onWishlist?: (id: number) => void;
  className?: string;
}) {
  const { isAuthenticated } = useAuthStore();
  const { increment } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);

  const mainImg =
    p.media?.find((m) => m.is_primary)?.media_url || p.media?.[0]?.media_url;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    if (!isAuthenticated) {
      toast.error("Please login to add to cart");
      return;
    }
    setIsAdding(true);
    try {
      await api.post("/api/cart/items", {
        product_id: p.id,
        quantity: 1,
        selected_config: {},
      });
      increment();
      toast.success("Added to cart!");
    } catch {
      toast.error("Failed to add to cart");
    } finally {
      setIsAdding(false);
    }
  };

  const priceStr = p.price?.toFixed(2) || "0.00";

  return (
    <Link 
      href={`/marketplace/${p.id}`}
      className={cn(
        "group flex flex-col bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover-lift hover-tilt",
        className
      )}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {mainImg ? (
          <img 
            src={api.mediaUrl(mainImg)} 
            alt={p.title}
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
            No Image
          </div>
        )}
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {p.is_featured ? (
             <Badge variant="default" className="bg-primary/90 text-primary-foreground shadow-lg border-transparent font-bold px-2.5 py-0.5 backdrop-blur-sm">
               Featured
             </Badge>
          ) : <div />}
        </div>
        
        {/* Capability Indicators */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 z-10 translate-y-1 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          {p.is_mode_2_active && (
            <div className="bg-background/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-border/50 text-primary" title="Digital Download">
              <Download size={14} />
            </div>
          )}
          {p.is_mode_3_active && (
            <div className="bg-background/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-border/50 text-success" title="Physical Print">
              <Printer size={14} />
            </div>
          )}
          {p.is_mode_4_active && (
            <div className="bg-background/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-border/50 text-warning" title="Customizable">
              <Wand2 size={14} />
            </div>
          )}
        </div>
      </div>

      {/* Info Container */}
      <div className="flex flex-col flex-1 p-5 relative z-20">
        <h3 className="text-foreground text-lg leading-tight line-clamp-1 font-display font-bold group-hover:text-primary transition-colors mb-2">
          {p.title}
        </h3>
        
        {/* Rich Metadata Section */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
          <div className="flex items-center gap-1 text-warning font-bold">
            <Star size={14} className="fill-current" />
            <span>{p.avg_rating ? p.avg_rating.toFixed(1) : "New"}</span>
          </div>
          <span className="text-border text-xs">•</span>
          <span className="font-data">{p.review_count || 0} Downloads</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4">
          <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded-sm">
            Printable ✓
          </span>
          <span className="truncate">Creator: <span className="text-foreground">{p.creator_name || "Unknown"}</span></span>
        </div>

        {/* Price & Action Row */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
          <span className="text-xl font-bold text-foreground font-data whitespace-nowrap">
            ${priceStr}
          </span>
          
          <Button 
            onClick={handleAddToCart}
            disabled={isAdding}
            variant="ghost"
            size="sm"
            className="group/btn text-primary hover:text-primary hover:bg-primary/10"
          >
            <span>{isAdding ? "Adding..." : "View Model"}</span>
            {isAdding ? (
              <Loader2 size={14} className="animate-spin ml-2" />
            ) : (
              <ArrowRight size={14} className="ml-1 opacity-70 group-hover/btn:translate-x-1 transition-transform" />
            )}
          </Button>
        </div>
      </div>
    </Link>
  );
}
