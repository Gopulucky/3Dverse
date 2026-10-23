import type { ReactNode } from "react";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MarketplaceShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-10">Last updated {LEGAL_LAST_UPDATED}</p>
        <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </article>
    </MarketplaceShell>
  );
}
