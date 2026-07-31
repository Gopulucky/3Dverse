import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/wordmark";
import {
  ArrowRight,
  Palette,
  ShoppingBag,
  Printer,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  BRAND,
  MISSION,
  PRINCIPLES,
  AUDIENCES,
  PILLARS,
  TIMELINE,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: BRAND.oneLiner,
};

const AUDIENCE_ICON = {
  creators: Palette,
  customers: ShoppingBag,
  partners: Printer,
} as const;

const AUDIENCE_ACCENT = {
  creators: { text: "text-ember", bg: "bg-ember/10", border: "border-ember/20" },
  customers: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  partners: { text: "text-moss", bg: "bg-moss/10", border: "border-moss/20" },
} as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pt-16">
        {/* ============================== HERO ============================== */}
        <section className="relative py-24 px-6 overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm border border-primary/20 mb-8">
              <Sparkles size={16} /> {BRAND.positioning}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              We&apos;re building the operating system for physical creation.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {BRAND.oneLiner}
            </p>
          </div>
        </section>

        {/* ============================== MISSION ============================== */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Our mission</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
              {MISSION.statement}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">{MISSION.body}</p>
          </div>
        </section>

        {/* ============================== WHAT WE ARE — 3 pillars ============================== */}
        <section className="py-24 px-6 bg-muted/20 border-y border-border/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">What we are</p>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                One platform, three systems working as one.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                None of these pieces is novel on its own. Run together, they remove every excuse
                a good design has for never becoming a real object.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {PILLARS.map((pillar) => (
                <div key={pillar.title} className="bg-card p-8 rounded-3xl border border-border shadow-sm">
                  <h3 className="text-xl font-bold font-display mb-3">{pillar.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== HOW WE WORK — audiences ============================== */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">How the organization works</p>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                Three sides. One network.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every account on 3DVerse belongs to one of three groups. Each has its own portal,
                its own tools, and its own reason to keep the network growing.
              </p>
            </div>

            <div className="space-y-8">
              {AUDIENCES.map((audience) => {
                const Icon = AUDIENCE_ICON[audience.key];
                const accent = AUDIENCE_ACCENT[audience.key];
                return (
                  <div
                    key={audience.key}
                    className={`grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 md:gap-12 p-8 md:p-10 rounded-3xl border ${accent.border} bg-card shadow-sm`}
                  >
                    <div>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${accent.bg}`}>
                        <Icon size={28} className={accent.text} />
                      </div>
                      <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${accent.text}`}>
                        {audience.label}
                      </p>
                      <h3 className="text-2xl font-bold font-display mb-3">{audience.headline}</h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">{audience.summary}</p>
                      <Button variant="outline" className="rounded-xl gap-2 group" asChild>
                        <Link href={audience.cta.href}>
                          {audience.cta.label}
                          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground/70 uppercase tracking-wider mb-4">
                        What they can do
                      </p>
                      <ul className="space-y-3">
                        {audience.capabilities.map((cap) => (
                          <li key={cap} className="flex items-start gap-3">
                            <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${accent.text}`} />
                            <span className="text-sm text-muted-foreground leading-relaxed">{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================== PRINCIPLES ============================== */}
        <section className="py-24 px-6 bg-muted/20 border-y border-border/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">How we operate</p>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                Principles, not slogans.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                These are the calls we make when a decision could go either way.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold font-display mb-4">
                    {i + 1}
                  </div>
                  <h3 className="font-bold font-display mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== STORY / TIMELINE ============================== */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">How we got here</p>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">The story so far</h2>
            </div>
            <div className="space-y-10">
              {TIMELINE.map((t, i) => (
                <div key={t.title} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-1.5" />
                    {i !== TIMELINE.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{t.period}</p>
                    <h3 className="text-lg font-bold font-display mb-2">{t.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== BRAND LINK-OUT ============================== */}
        <section className="py-16 px-6 bg-muted/20 border-y border-border/30">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
              Looking for logo files, colors, or voice guidelines?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              The full identity system — palette, typography, and how we write — lives on the brand page.
            </p>
            <Button variant="outline" className="rounded-xl gap-2 group" asChild>
              <Link href="/brand">
                View the brand guidelines <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ============================== CTA ============================== */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto bg-foreground text-background rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
            <p className="text-sm font-bold uppercase tracking-wider mb-6 text-background/50 relative z-10">
              <Wordmark size="sm" className="[&_span:last-child]:text-background" />
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 relative z-10">
              Every design deserves a marketplace.
            </h2>
            <p className="text-xl text-background/70 mb-10 max-w-2xl mx-auto relative z-10">
              Join as a creator, browse as a customer, or bring your printers into the network.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
              <Button size="lg" variant="secondary" className="px-10 h-14 text-lg rounded-xl font-bold" asChild>
                <Link href="/register">Join the ecosystem</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-10 h-14 text-lg rounded-xl font-bold bg-transparent border-background/20 hover:bg-background/10 text-background"
                asChild
              >
                <Link href="/marketplace/home">Explore the marketplace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
