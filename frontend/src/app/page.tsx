import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { MarketplaceHomeContent } from "@/components/marketplace/home-content";
import { getHomepageData } from "@/lib/server-data";

export const revalidate = 60;

/**
 * Root route — the marketplace itself, open to everyone. No gated landing
 * page in front of it; "/" and "/marketplace/home" render the same content.
 */
export default async function RootPage() {
  const initialData = await getHomepageData();
  return (
    <MarketplaceShell>
      <MarketplaceHomeContent initialData={initialData} />
    </MarketplaceShell>
  );
}
