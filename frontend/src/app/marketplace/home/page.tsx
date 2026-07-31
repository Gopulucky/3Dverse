"use client";

import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { MarketplaceHomeContent } from "@/components/marketplace/home-content";

export default function MarketplaceHome() {
  return (
    <MarketplaceShell>
      <MarketplaceHomeContent />
    </MarketplaceShell>
  );
}
