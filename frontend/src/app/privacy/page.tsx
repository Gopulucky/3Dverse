import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What personal data 3DVerse collects, why, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        3DVerse is a marketplace where creators sell 3D designs and print partners make physical
        prints. This policy explains what we collect when you use it and what we do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, password (stored only as a one-way hash), role (customer, creator or print partner) and any profile details you add, such as name, bio, company, tax ID and PIN code.</li>
        <li><strong>Order data:</strong> items ordered, delivery details, order status and invoices.</li>
        <li><strong>Content you upload:</strong> 3D model files, images, portfolio items, reviews, messages and design requests.</li>
        <li><strong>Technical data:</strong> IP address and basic request logs, used to keep the service secure and to limit abuse.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account, process and fulfil orders, and let creators and print partners work together.</li>
        <li>To send service emails, such as email verification and password resets.</li>
        <li>To prevent fraud and abuse, and to fix problems.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>Who sees it</h2>
      <ul>
        <li><strong>Creators and print partners</strong> see only what they need to fulfil an order, such as the item and delivery details.</li>
        <li><strong>Service providers</strong> that host or process data for us: our hosting, database and file-storage providers, and a payment processor once online payments are enabled. Card details go directly to the payment processor and are never stored by 3DVerse.</li>
        <li><strong>Authorities</strong>, where the law requires it.</li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        We use your browser&apos;s local storage to keep you signed in and to remember your theme and
        cart. We do not use advertising cookies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can edit your profile and change your password in Settings.</li>
        <li>You can delete your account in Settings. Order records may be kept where we are required to keep them for accounting or legal reasons.</li>
        <li>You can ask for a copy of your data, or for corrections, by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Passwords are hashed, traffic is encrypted in transit, and paid files are available only to
        people entitled to them. No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>Children</h2>
      <p>3DVerse is not intended for children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>
        We may update this policy and will change the date above when we do. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
