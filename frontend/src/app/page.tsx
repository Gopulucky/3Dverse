"use client";

import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { MarketplaceHomeContent } from "@/components/marketplace/home-content";

/**
 * Root route — the marketplace itself, open to everyone. No gated landing
 * page in front of it; "/" and "/marketplace/home" render the same content.
 */
export default function RootPage() {
  return (
    <MarketplaceShell>
      <MarketplaceHomeContent />
    </MarketplaceShell>
  );
}
