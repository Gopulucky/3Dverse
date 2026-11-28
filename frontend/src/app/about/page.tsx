import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { BRAND, MISSION, PRINCIPLES, AUDIENCES, PILLARS, TIMELINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: BRAND.oneLiner,
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pt-16">
        <section className="band">
          <div className="store-container">
            {/* The opening reads as one centred column; the grids below use the full width. */}
            <div className="mx-auto max-w-3xl">
              <h1 className="display page-title">We&apos;re building the operating system for physical creation.</h1>
              <p className="page-lead">{BRAND.oneLiner}</p>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="store-container">
            <div className="mx-auto max-w-3xl">
              <h2 className="display band-title">{MISSION.statement}</h2>
              <p className="text-muted-foreground leading-relaxed">{MISSION.body}</p>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="store-container">
            <h2 className="display band-title">One platform, three systems working as one.</h2>
            <p className="page-lead">
              None of these pieces is novel on its own. Run together, they remove every excuse
              a good design has for never becoming a real object.
            </p>
            <div className="band-columns">
              {PILLARS.map((pillar) => (
                <div key={pillar.title} className="band-column">
                  <h3>{pillar.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band">
          <div className="store-container">
            <h2 className="display band-title">Three sides. One network.</h2>
            <p className="page-lead mb-8">
              Every account on buy&sell3d belongs to one of three groups. Each has its own portal,
              its own tools, and its own reason to keep the network growing.
            </p>
            {AUDIENCES.map((audience) => (
              <div key={audience.key} className="band-row">
                <div>
                  <p className="band-name">{audience.label}</p>
                  <h3>{audience.headline}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">{audience.summary}</p>
                  <Button variant="outline" size="lg" asChild>
                    <Link href={audience.cta.href}>{audience.cta.label}</Link>
                  </Button>
                </div>
                <ul className="divide-y divide-border self-start" aria-label={`What ${audience.label.toLowerCase()} can do`}>
                  {audience.capabilities.map((capability) => (
                    <li key={capability} className="py-3 leading-relaxed">{capability}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="band">
          <div className="store-container">
            <h2 className="display band-title">Principles, not slogans.</h2>
            <p className="page-lead">These are the calls we make when a decision could go either way.</p>
            <div className="band-columns">
              {PRINCIPLES.map((principle) => (
                <div key={principle.title} className="band-column">
                  <h3>{principle.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{principle.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band">
          <div className="store-container">
            <h2 className="display band-title">The story so far</h2>
            {TIMELINE.map((entry) => (
              <div key={entry.title} className="band-row">
                <p className="band-name">{entry.period}</p>
                <div>
                  <h3>{entry.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{entry.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="band border-b-0">
          <div className="store-container">
            <h2 className="display band-title">Every design deserves a marketplace.</h2>
            <p className="mb-8 max-w-2xl text-muted-foreground">
              Join as a creator, browse as a customer, or bring your printers into the network.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Join the ecosystem</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
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
