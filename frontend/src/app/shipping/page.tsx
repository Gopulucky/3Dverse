import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "How and when physical 3DVerse orders are made and delivered.",
};

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping Policy">
      <h2>Digital files</h2>
      <p>Available to download from your orders page as soon as payment is confirmed. Nothing is shipped.</p>

      <h2>Physical prints</h2>
      <ul>
        <li>Made-to-order items are printed by a print partner near you where possible. Production time depends on the item and is shown on the listing or at checkout.</li>
        <li>Ready-stock items ship from the seller&apos;s stock, usually sooner.</li>
        <li>You will see your order status update as it moves from paid, to printing, to shipped, to delivered.</li>
      </ul>

      <h2>Delivery details</h2>
      <p>
        Please check your delivery address and PIN code before ordering. If a parcel is returned because
        of an incorrect address, we will contact you to arrange re-delivery, which may cost extra.
      </p>

      <h2>Delays and damage</h2>
      <p>
        Delivery estimates are not guarantees. If your order is late, or arrives damaged, contact us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Defects follow the{" "}
        <Link href="/refund-policy">Refund &amp; Returns Policy</Link>.
      </p>
    </LegalPage>
  );
}
