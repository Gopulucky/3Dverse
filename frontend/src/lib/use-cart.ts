"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CartLine } from "@/lib/cart-summary";

export interface Cart {
  id: number;
  items: CartLine[];
}

/** One key for the whole app, so the navbar badge and the cart page share one request. */
export const CART_KEY = ["cart"] as const;

export function useCart(enabled: boolean) {
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => api.get<Cart>("/api/cart/"),
    enabled,
    staleTime: 30_000,
  });
}
