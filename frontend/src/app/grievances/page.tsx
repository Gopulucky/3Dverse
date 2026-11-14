import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { BUSINESS_ADDRESS, GRIEVANCE_OFFICER, GSTIN, LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Grievances and listing reports",
  description: "Raise a complaint, or report a listing that copies someone else's design or is unsafe.",
};

const subject = (text: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(text)}`;

export default function GrievancesPage() {
  const business = [
    LEGAL_NAME && { label: "Legal name", value: LEGAL_NAME },
    BUSINESS_ADDRESS && { label: "Address", value: BUSINESS_ADDRESS },
    GSTIN && { label: "GSTIN", value: GSTIN },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <LegalPage title="Grievances and listing reports">
      <h2>Grievance officer</h2>
      <ul>
        {GRIEVANCE_OFFICER && <li>Name: {GRIEVANCE_OFFICER}</li>}
        <li>Role: Grievance officer</li>
        <li className="flex items-center gap-2"><Mail size={16} aria-hidden /> <a href={subject("Grievance")}>{SUPPORT_EMAIL}</a></li>
      </ul>
      <p>
        We acknowledge every complaint within 48 hours and aim to resolve it within one month. Please include
        your account email, the order number if there is one, and what went wrong.
      </p>

      <h2 id="report">Report a listing</h2>
      <p>Tell us if a listing:</p>
      <ul>
        <li>copies a design you own, or one shared under a licence that does not allow selling;</li>
        <li>is unsafe, misleading, or breaks our <Link href="/terms">terms</Link>.</li>
      </ul>
      <p>
        Email <a href={subject("Listing report")}>{SUPPORT_EMAIL}</a> with the link to the listing, what the problem is
        and, for a copyright report, where the original design is published and how you are connected to it. We review
        every report, may hide the listing while we check, and tell the creator so they can respond.
      </p>

      <h2>For creators</h2>
      <p>
        By publishing a listing you confirm that you made the design or have the right to sell it in every format you
        offer, and that the details you give about it are true.
      </p>

      {business.length > 0 && <>
        <h2>Business details</h2>
        <ul>{business.map(item => <li key={item.label}>{item.label}: {item.value}</li>)}</ul>
      </>}
    </LegalPage>
  );
}
