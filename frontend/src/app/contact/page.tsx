import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get help with an order, a listing or your account.",
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact us">
      <p>We are a small team and read every message. Email us for anything below.</p>
      <p className="flex items-center gap-2 text-lg">
        <Mail size={20} aria-hidden /> <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <h2>To help us reply faster, include</h2>
      <ul>
        <li>Your account email and, for orders, the order number.</li>
        <li>What you expected and what happened, with a screenshot or photo if it helps.</li>
        <li>For a copyright or safety report, the link to the listing.</li>
      </ul>
    </LegalPage>
  );
}
