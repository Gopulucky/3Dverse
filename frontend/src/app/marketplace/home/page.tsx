import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { MarketplaceHomeContent } from "@/components/marketplace/home-content";
import { getHomepageData } from "@/lib/server-data";

export const revalidate = 60;

export default async function MarketplaceHome() {
  const initialData = await getHomepageData();
  return (
    <MarketplaceShell>
      <MarketplaceHomeContent initialData={initialData} />
    </MarketplaceShell>
  );
}
