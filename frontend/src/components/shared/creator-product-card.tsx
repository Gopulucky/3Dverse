import Link from "next/link";
import { Star, Eye, ShoppingCart, DollarSign, Edit, Copy, Trash2, MoreVertical } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreatorProductCard({ product }: { product: any }) {
  const mainImg = product.media?.find((m: any) => m.is_primary)?.media_url || product.media?.[0]?.media_url;
  
  let statusColor = "bg-muted text-muted-foreground";
  if (product.status === "published") statusColor = "bg-success/20 text-success border-success/30";
  if (product.status === "draft") statusColor = "bg-warning/20 text-warning border-warning/30";
  
  return (
    <Card className="flex flex-col md:flex-row gap-4 p-4 border-border bg-card hover-lift transition-all group overflow-hidden">
      {/* Thumbnail */}
      <div className="w-full md:w-48 aspect-video md:aspect-square bg-muted rounded-xl overflow-hidden shrink-0 relative">
        {mainImg ? (
          <img 
            src={api.mediaUrl(mainImg)} 
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No Preview</div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider border backdrop-blur-md ${statusColor}`}>
            {product.status || "Draft"}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 flex flex-col min-w-0 py-2">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div>
            <h3 className="text-xl font-bold font-display text-foreground truncate mb-1">
              {product.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-warning font-semibold">
                <Star size={12} className="fill-current" /> {product.avg_rating ? product.avg_rating.toFixed(1) : "New"}
              </span>
              <span className="text-border">•</span>
              <span>{product.review_count || 0} Downloads</span>
            </div>
          </div>
          
          <div className="text-right">
            <span className="text-xl font-bold font-data text-foreground">
              ${product.price?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>

        {/* Mini Stats */}
        <div className="flex flex-wrap gap-4 mt-auto pt-4 border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><DollarSign size={10} /> Revenue</span>
            <span className="font-data font-bold text-sm text-foreground">${product.revenue?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><Eye size={10} /> Views</span>
            <span className="font-data font-bold text-sm text-foreground">{product.views || "1.2k"}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><ShoppingCart size={10} /> Orders</span>
            <span className="font-data font-bold text-sm text-foreground">{product.orders || "0"}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex md:flex-col items-center justify-end gap-2 md:pl-4 md:border-l border-border/50 shrink-0">
        <Button asChild className="w-full md:w-28 text-xs font-semibold" size="sm">
          <Link href={`/creator/products/${product.id}`}>
            <Edit size={14} className="mr-2" /> Edit
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full md:w-28 text-xs text-muted-foreground">
              More <MoreVertical size={14} className="ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 border-border bg-card">
            <DropdownMenuItem className="cursor-pointer">
              <Copy size={14} className="mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <Trash2 size={14} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
