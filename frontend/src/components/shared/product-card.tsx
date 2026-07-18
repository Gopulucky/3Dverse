"use client";

import Link from "next/link";
import { Star, Download, Printer, Wand2, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function ModeBadges({ p }: { p: ProductCardData }) {
  return (
    <div className="absolute bottom-3 left-3 flex gap-1.5">
      {p.is_mode_2_active && (
        <span className="flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-sm border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
          <Download size={10} className="text-primary" /> Digital
        </span>
      )}
      {p.is_mode_3_active && (
        <span className="flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-sm border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
          <Printer size={10} className="text-calibration-cyan" /> Print
        </span>
      )}
      {p.is_mode_4_active && (
        <span className="flex items-center gap-1 rounded-full bg-card/85 backdrop-blur-sm border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
          <Wand2 size={10} className="text-nozzle-orange" /> Custom
        </span>
      )}
    </div>
  );
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
  const mainImg =
    p.media?.find((m) => m.is_primary)?.media_url || p.media?.[0]?.media_url;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col shadow-sm",
        className
      )}
    >
      <Link
        href={`/marketplace/${p.id}`}
        className="block aspect-square bg-muted relative overflow-hidden"
      >
        {mainImg ? (
          <img
            src={api.mediaUrl(mainImg)}
            alt={p.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No Image
          </div>
        )}
        {p.is_featured && (
          <Badge className="absolute top-3 left-3 bg-primary text-white border-transparent">
            Featured
          </Badge>
        )}
        <ModeBadges p={p} />
      </Link>

      {onWishlist && (
        <button
          onClick={() => onWishlist(p.id)}
          aria-label="Add to wishlist"
          className="absolute top-3 right-3 p-2 rounded-full bg-card/85 backdrop-blur-sm border border-border text-foreground hover:text-danger-red hover:border-danger-red/30 transition-all z-10"
        >
          <Heart size={16} />
        </button>
      )}

      <div className="p-4 flex-1 flex flex-col">
        <p className="text-xs text-primary font-semibold mb-1 tracking-wider uppercase">
          {p.category}
        </p>
        <h3 className="text-foreground font-bold truncate mb-1 font-display">
          <Link
            href={`/marketplace/${p.id}`}
            className="hover:text-primary transition-colors"
          >
            {p.title}
          </Link>
        </h3>
        {p.creator_name && (
          <p className="text-xs text-muted-foreground truncate mb-2">
            by <span className="font-medium text-foreground/80">{p.creator_name}</span>
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <p className="text-foreground font-bold font-data">
            ${p.price?.toFixed(2)}
          </p>
          <span className="flex items-center gap-1 text-sm">
            <Star
              size={14}
              className="text-nozzle-orange"
              fill="currentColor"
            />
            {p.avg_rating != null ? (
              <>
                <span className="font-semibold text-foreground font-data">
                  {p.avg_rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-xs font-data">
                  ({p.review_count})
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">New</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
