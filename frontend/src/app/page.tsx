"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Palette,
  Printer,
  Shield,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Star,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

const portals = [
  {
    href: "/marketplace/home",
    title: "Marketplace",
    desc: "Discover, download, and purchase stunning 3D-printed goods from creators worldwide.",
    icon: ShoppingBag,
    accentColor: "text-cure-violet",
    accentBg: "bg-cure-violet/10",
    borderHover: "hover:border-cure-violet/30",
    glowShadow: "hover:shadow-[0_20px_60px_-15px_rgba(110,91,255,0.2)]",
    delay: "0ms",
  },
  {
    href: "/creator/products",
    title: "Creator Studio",
    desc: "Upload your designs, set pricing, and earn royalties on every sale and print.",
    icon: Palette,
    accentColor: "text-nozzle-orange",
    accentBg: "bg-nozzle-orange/10",
    borderHover: "hover:border-nozzle-orange/30",
    glowShadow: "hover:shadow-[0_20px_60px_-15px_rgba(255,90,54,0.2)]",
    delay: "100ms",
  },
  {
    href: "/partner",
    title: "Print Partner",
    desc: "Manage your print facility, accept jobs, and fulfill orders with quality precision.",
    icon: Printer,
    accentColor: "text-calibration-cyan",
    accentBg: "bg-calibration-cyan/10",
    borderHover: "hover:border-calibration-cyan/30",
    glowShadow: "hover:shadow-[0_20px_60px_-15px_rgba(47,211,194,0.2)]",
    delay: "200ms",
  },
];

const stats = [
  { value: "10K+", label: "3D Models", icon: Sparkles },
  { value: "500+", label: "Creators", icon: Palette },
  { value: "99%", label: "Quality Rate", icon: Star },
  { value: "50+", label: "Print Partners", icon: Globe },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Layer-line grid pattern background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(110,91,255,0.08),transparent_70%)]" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(47,211,194,0.05),transparent_70%)]" />
        {/* Layer-line hairline grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--color-foreground) 0px, var(--color-foreground) 1px, transparent 1px, transparent 4px)",
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Pre-headline badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/50 text-sm text-muted-foreground mb-8 transition-all duration-700",
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <Layers size={14} className="text-primary" />
            <span>Built layer by layer</span>
          </div>

          {/* Headline — Space Grotesk */}
          <h1
            className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8 font-display transition-all duration-700 delay-100",
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            Where{" "}
            <span className="text-gradient-primary">Imagination</span>
            <br />
            Becomes{" "}
            <span className="text-gradient-warm">Reality</span>
          </h1>

          {/* Subheadline */}
          <p
            className={cn(
              "text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-700 delay-200",
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            The premium marketplace connecting 3D creators, customers, and print
            partners. Discover extraordinary designs, order custom prints, and
            bring digital art to life.
          </p>

          {/* CTA */}
          <div
            className={cn(
              "flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 delay-300",
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <Button size="xl" variant="glow" asChild>
              <Link href="/marketplace/home">
                Explore Marketplace
                <ArrowRight size={20} />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/register">Start Creating</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative py-8 border-y border-border/50 bg-card/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 justify-center"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <stat.icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground font-data">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal cards */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 font-display">
            Choose Your Portal
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
            Whether you&apos;re shopping, creating, or printing — 3DVerse has a
            dedicated experience built for you.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {portals.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className={cn(
                  "group relative rounded-xl border border-border bg-card/50 p-8 transition-all duration-300 hover:-translate-y-1 overflow-hidden",
                  portal.borderHover,
                  portal.glowShadow
                )}
              >
                <div className="relative">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110",
                      portal.accentBg
                    )}
                  >
                    <portal.icon size={24} className={portal.accentColor} />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-3 font-display">
                    {portal.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {portal.desc}
                  </p>

                  <span className={cn(
                    "inline-flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all duration-300",
                    portal.accentColor
                  )}>
                    Enter Portal
                    <ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Admin link */}
          <div className="flex justify-center mt-8">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-300"
            >
              <Shield size={16} />
              Admin Panel
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
