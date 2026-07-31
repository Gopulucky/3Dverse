import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/wordmark";
import { ArrowRight, Check, X } from "lucide-react";
import { BRAND, BRAND_VOICE, BRAND_COLORS, BRAND_TYPE, LOGO_RULES } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Brand",
  description: `Identity guidelines for ${BRAND.name} — logo usage, palette, typography, and voice.`,
};

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pt-16">
        {/* ============================== HERO ============================== */}
        <section className="py-24 px-6 border-b border-border/50 text-center">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Brand guidelines</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold tracking-tight mb-6">
            The 3DVerse identity system.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            How the mark, palette, type, and voice fit together — and how to use them consistently
            across the marketplace, creator studio, and print partner hub.
          </p>
        </section>

        {/* ============================== LOGO ============================== */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-8">Logo</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="rounded-3xl border border-border bg-card p-12 flex items-center justify-center">
                <Wordmark size="lg" />
              </div>
              <div className="grid grid-rows-2 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-bold text-success uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Check size={14} /> Do
                  </p>
                  <ul className="space-y-2">
                    {LOGO_RULES.do.map((r) => (
                      <li key={r} className="text-sm text-muted-foreground leading-relaxed">{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <X size={14} /> Don&apos;t
                  </p>
                  <ul className="space-y-2">
                    {LOGO_RULES.dont.map((r) => (
                      <li key={r} className="text-sm text-muted-foreground leading-relaxed">{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================== COLOR ============================== */}
        <section className="py-20 px-6 bg-muted/20 border-y border-border/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Color</h2>
            <p className="text-muted-foreground mb-10 max-w-2xl">
              Paper-first and light by default. Accent colors are assigned by portal — violet for
              the marketplace and creators, orange for selling, green for the print network.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {BRAND_COLORS.map((c) => (
                <div key={c.name} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className={`h-24 ${c.className}`} />
                  <div className="p-5">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-bold font-display">{c.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">{c.hex}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== TYPE ============================== */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Typography</h2>
            <p className="text-muted-foreground mb-10 max-w-2xl">
              Three families, each with one job. Display carries the voice, body carries the
              content, mono carries the numbers.
            </p>
            <div className="space-y-6">
              {BRAND_TYPE.map((t) => (
                <div key={t.role} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">{t.role} — {t.family}</p>
                    <p className="text-xs text-muted-foreground">{t.usage}</p>
                  </div>
                  <p className={`text-3xl sm:text-4xl ${t.className}`}>Upload Once. Sell Forever.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== VOICE ============================== */}
        <section className="py-20 px-6 bg-muted/20 border-y border-border/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Voice</h2>
            <p className="text-muted-foreground mb-10 max-w-2xl">
              Plain, specific, and honest about numbers. We write like the people we&apos;re
              building for — engineers, hobbyists, and shop owners — not like a press release.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {BRAND_VOICE.map((v) => (
                <div key={v.do} className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-bold text-success uppercase tracking-wider mb-2">{v.do}</p>
                  <p className="text-sm text-foreground bg-success-surface rounded-lg p-3 mb-4">
                    &ldquo;{v.example.good}&rdquo;
                  </p>
                  <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-2">{v.dont}</p>
                  <p className="text-sm text-muted-foreground bg-danger-surface rounded-lg p-3">
                    &ldquo;{v.example.bad}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== CTA ============================== */}
        <section className="py-20 px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
            Want the fuller story?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Read about our mission, principles, and how creators, customers, and print partners
            work together.
          </p>
          <Button variant="outline" className="rounded-xl gap-2 group" asChild>
            <Link href="/about">
              About 3DVerse <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
