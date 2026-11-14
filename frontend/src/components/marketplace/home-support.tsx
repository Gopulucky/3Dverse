import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Optional contribution prompt. Rendered only when a support payment page is configured. */
export function HomeSupport() {
  return (
    <section className="store-section" aria-labelledby="home-support-title">
      <div className="store-container">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <HeartHandshake size={28} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 id="home-support-title" className="font-display text-xl font-semibold">Like what we’re building?</h2>
              <p className="mt-1 max-w-xl text-muted-foreground leading-relaxed">
                A small, optional contribution helps keep the site running while we get printing ready. Shopping stays open to everyone either way.
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="min-h-12 shrink-0">
            <Link href="/support">Support 3DVerse</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
