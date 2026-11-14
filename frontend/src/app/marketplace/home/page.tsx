import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { MarketplaceHomeContent } from "@/components/marketplace/home-content";
import { getHomepageData } from "@/lib/server-data";
import { getSupportPaymentUrl } from "@/lib/support";

export const revalidate = 60;

export default async function MarketplaceHome() {
  const initialData = await getHomepageData();
  return (
    <MarketplaceShell>
      <MarketplaceHomeContent initialData={initialData} supportOpen={getSupportPaymentUrl(process.env.SUPPORT_PAYMENT_URL) !== null} />
    </MarketplaceShell>
  );
}
