import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/site";
import { getSupportPaymentUrl } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support 3DVerse",
  description: "Make an optional one-time contribution to help maintain and grow 3DVerse.",
};

export default async function SupportPage() {
  await connection();
  const paymentUrl = getSupportPaymentUrl(process.env.SUPPORT_PAYMENT_URL);

  return (
    <MarketplaceShell>
      <article className="store-container py-12 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
          <header className="min-w-0">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight break-words">
              Support 3DVerse
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground leading-relaxed">
              Help keep 3DVerse running and give our startup room to grow.
            </p>
            <Button asChild variant="link" className="mt-6 px-0 text-base min-h-11">
              <Link href="/marketplace">Keep exploring the marketplace</Link>
            </Button>
          </header>

          <section aria-labelledby="contribution-heading" className="rounded-xl border border-border bg-card p-6 sm:p-8 min-w-0">
            <h2 id="contribution-heading" className="font-display text-2xl font-semibold">A little help, by choice</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A voluntary, one-time contribution. Browsing and shopping are always open to you either way.
            </p>
            {paymentUrl ? (
              <>
                <Button asChild size="lg" className="mt-6 w-full">
                  <a href={paymentUrl} target="_blank" rel="noopener noreferrer" aria-describedby="payment-details">
                    Make a contribution
                  </a>
                </Button>
                <p id="payment-details" className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Opens the payment provider in a new tab. Review the recipient, amount and currency there before paying. No 3DVerse sign-in needed.
                </p>
              </>
            ) : (
              <p role="status" className="mt-6 border-l-2 border-primary pl-4 leading-relaxed">
                Contributions aren’t available yet. You can still help by sharing 3DVerse or sending us feedback.
              </p>
            )}
          </section>
        </div>

        <section aria-labelledby="support-purpose" className="mt-16 sm:mt-20 border-t border-border pt-8">
          <h2 id="support-purpose" className="font-display text-2xl font-semibold">What your support helps us do</h2>
          <dl className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-lg">Keep the website running</dt>
              <dd className="mt-2 text-muted-foreground leading-relaxed max-w-md">Hosting, file storage, routine maintenance and a more reliable experience.</dd>
            </div>
            <div>
              <dt className="font-semibold text-lg">Build what comes next</dt>
              <dd className="mt-2 text-muted-foreground leading-relaxed max-w-md">Product improvements that help customers discover designs and creators reach more people.</dd>
            </div>
          </dl>
        </section>

        <div className="mt-10 max-w-2xl text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>Contributions support the business. They don’t purchase products, shares or special account benefits, and we make no charitable tax-deduction claim.</p>
          <p>For payment confirmation, use the provider’s receipt. Questions about a contribution or a refund?</p>
          <Button asChild variant="link" className="px-0 min-h-11">
            <a href={`mailto:${SUPPORT_EMAIL}`}>Contact the 3DVerse team</a>
          </Button>
        </div>
      </article>
    </MarketplaceShell>
  );
}
