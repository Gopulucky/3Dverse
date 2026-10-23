import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using 3DVerse as a customer, creator or print partner.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By creating an account or placing an order on 3DVerse you agree to these terms. If you do
        not agree, please do not use the service.
      </p>

      <h2>The service</h2>
      <p>
        3DVerse is a marketplace. Creators list 3D designs, customers buy digital files or physical
        prints, and print partners manufacture and ship physical items. 3DVerse connects these
        parties and provides the platform; individual creators and partners are responsible for their
        own designs and work.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must give accurate information and keep your password secret. You are responsible for activity on your account.</li>
        <li>You must be old enough to form a binding contract where you live.</li>
        <li>We may suspend or remove accounts that break these terms or put others at risk.</li>
      </ul>

      <h2>Buying</h2>
      <ul>
        <li>Prices are shown at checkout. An order is confirmed once payment succeeds.</li>
        <li>Digital files are for your personal use unless the listing says otherwise. You may not resell or redistribute them.</li>
        <li>Returns and refunds are covered in the <Link href="/refund-policy">Refund &amp; Returns Policy</Link>, and delivery in the <Link href="/shipping">Shipping Policy</Link>.</li>
      </ul>

      <h2>Selling and uploading</h2>
      <ul>
        <li>You may upload only designs you created or have the right to sell, and content that is lawful.</li>
        <li>You keep ownership of your designs. You give 3DVerse permission to host, display, preview and deliver them to buyers, and to share files with the print partner assigned to an order.</li>
        <li>Listings are reviewed for printability and safety. We may reject or remove a listing, including designs for weapons or other dangerous items, infringing material or anything unsafe.</li>
        <li>Platform fees and payout timing are shown in the Creator Studio before you sell.</li>
      </ul>

      <h2>Print partners</h2>
      <p>
        Print partners agree to produce orders to the quality and timelines agreed with 3DVerse, and
        to use customer details and design files only to fulfil the order.
      </p>

      <h2>Intellectual property</h2>
      <p>
        If you believe content on 3DVerse infringes your rights, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the link and details and we will
        review it promptly. Repeat infringers may be removed.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not attempt to break, overload or scrape the service, access other people&apos;s data,
        upload malware, or use 3DVerse for fraud.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the extent the law allows, 3DVerse is not liable
        for indirect or consequential losses, and our total liability for any claim is limited to the
        amount you paid for the order concerned. Nothing here limits rights you have under consumer law
        that cannot be limited.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will change the date above. Continuing to use the service means
        you accept the update. Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
