import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund & Returns Policy",
  description: "How refunds, reprints and returns work for digital files, made-to-order prints and ready stock.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Returns Policy">
      <p>What happens if something is wrong depends on what you bought.</p>

      <h2>Digital files</h2>
      <p>
        Digital downloads cannot be returned once downloaded. If a file is corrupted, does not open, or
        is not what the listing described, contact us and we will fix it or refund you.
      </p>

      <h2>Made-to-order prints</h2>
      <p>
        These are printed only after you order, so they are not returnable for change of mind. If your
        print arrives defective or damaged, report it within <strong>48 hours</strong> of the order from
        the order page, with a description and photos if you can. If approved, we reprint it free of
        charge.
      </p>

      <h2>Ready-stock items</h2>
      <p>
        Items a seller ships from existing stock can be returned within <strong>7 days</strong> of the
        order. Request the return from the order page. Once the item is received and approved, you are
        refunded and the item goes back into stock.
      </p>

      <h2>Cancellations</h2>
      <p>You can cancel an order yourself while it is still awaiting payment. After payment, contact us.</p>

      <h2>How refunds are paid</h2>
      <p>
        Approved refunds go back to your original payment method. Timing depends on your bank or
        payment provider and is usually 5–10 business days.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about an order: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Please include
        your order number.
      </p>
    </LegalPage>
  );
}
