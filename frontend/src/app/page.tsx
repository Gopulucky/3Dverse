"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { 
  ArrowRight, Printer, Sparkles, 
  UploadCloud, Bot, DollarSign, ShoppingBag, Truck, ChevronDown,
  BarChart3, Shield, Zap, Star, Users, Globe, TrendingUp,
  Palette, Package, Eye, CheckCircle2
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Hero3DObject } from "@/components/shared/hero-3d-object";

/* ================================================================
   Data
   ================================================================ */

const FLYWHEEL_STEPS = [
  { icon: UploadCloud, title: "Creators Upload", desc: "Better models every day", color: "text-primary", bg: "bg-primary/10" },
  { icon: Bot, title: "AI Validates", desc: "Quality guaranteed", color: "text-moss", bg: "bg-moss/10" },
  { icon: ShoppingBag, title: "Customers Buy", desc: "With confidence", color: "text-ember", bg: "bg-ember/10" },
  { icon: Printer, title: "Partners Print", desc: "Delivered fast", color: "text-warning", bg: "bg-warning/10" },
  { icon: DollarSign, title: "Creators Earn", desc: "Growing revenue", color: "text-success", bg: "bg-success/10" },
  { icon: Users, title: "More Join", desc: "Larger marketplace", color: "text-primary", bg: "bg-primary/10" },
];

const PERSONAS = [
  {
    title: "For Creators",
    tagline: "Turn your designs into a business.",
    icon: Palette,
    color: "text-primary",
    bg: "bg-primary/10",
    borderColor: "border-primary/20",
    features: [
      { icon: BarChart3, text: "Revenue analytics & AI insights" },
      { icon: TrendingUp, text: "Conversion funnel tracking" },
      { icon: Globe, text: "Reach customers who don't own printers" },
    ],
    cta: "Start Creating",
    ctaHref: "/register",
  },
  {
    title: "For Customers",
    tagline: "Buy any model, printed and delivered.",
    icon: ShoppingBag,
    color: "text-ember",
    bg: "bg-ember/10",
    borderColor: "border-ember/20",
    features: [
      { icon: Shield, text: "AI-verified quality before you buy" },
      { icon: Printer, text: "No printer needed — we handle it" },
      { icon: Truck, text: "Fast delivery from local partners" },
    ],
    cta: "Explore Models",
    ctaHref: "/marketplace",
  },
  {
    title: "For Print Partners",
    tagline: "Keep your printers working.",
    icon: Printer,
    color: "text-moss",
    bg: "bg-moss/10",
    borderColor: "border-moss/20",
    features: [
      { icon: Package, text: "Steady stream of print jobs" },
      { icon: DollarSign, text: "Predictable income" },
      { icon: Star, text: "Build reputation & grow" },
    ],
    cta: "Become a Partner",
    ctaHref: "/register",
  },
];

const AI_SCORES = [
  { label: "Model Score", value: "93/100", icon: CheckCircle2, color: "text-success" },
  { label: "Est. Revenue", value: "$320/mo", icon: TrendingUp, color: "text-primary" },
  { label: "Best Material", value: "PLA", icon: Package, color: "text-warning" },
  { label: "Print Success", value: "96%", icon: Shield, color: "text-moss" },
  { label: "Likely Buyers", value: "Mech. Engineers", icon: Users, color: "text-ember" },
  { label: "Suggested Price", value: "$18", icon: DollarSign, color: "text-success" },
];

const SOCIAL_PROOF = [
  { label: "Creators", value: "2,000+", icon: Palette },
  { label: "Models", value: "500+", icon: Package },
  { label: "Print Partners", value: "50+", icon: Printer },
  { label: "Cities", value: "15+", icon: Globe },
];

const FAQS = [
  { q: "How does the printing service work?", a: "When you buy a model with printing, we route the job to a vetted local print partner who manufactures and ships it directly to you." },
  { q: "Can I sell my own models?", a: "Yes! Sign up as a Creator to upload, price, and sell your designs. Our AI validates every model for printability." },
  { q: "What file formats are supported?", a: "We currently support STL, OBJ, and GLTF formats for our 3D viewer and quality checks." },
  { q: "What makes 3Dverse different from other marketplaces?", a: "We're the only platform that combines a creator marketplace, AI validation, and a distributed print network into one seamless ecosystem. Others solve one piece — we solve the entire lifecycle." },
];

/* ================================================================
   Component
   ================================================================ */

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated && mounted) {
      router.replace("/marketplace/home");
    }
  }, [isAuthenticated, mounted, router]);

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-x-hidden">
      <Navbar />

      {/* ════════════════════════════════════════════════════════════
         HERO — "Upload Once. Sell Forever. Print Anywhere."
         ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="text-left space-y-8">
            {/* Badge */}
            <Link href="/about" className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm border border-primary/20 transition-all duration-700 hover:bg-primary/15",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <Sparkles size={16} className="animate-pulse" /> The Operating System for 3D Commerce
            </Link>
            
            {/* Headline — staggered word reveal */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground font-display leading-[1.08]">
              <span className={cn(
                "block transition-all duration-700 delay-100",
                mounted ? "opacity-100" : "opacity-0 translate-y-8"
              )} style={mounted ? { animation: "word-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both" } : {}}>
                Upload Once.
              </span>
              <span className={cn(
                "block text-gradient-primary transition-all duration-700 delay-300",
              )} style={mounted ? { animation: "word-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both" } : { opacity: 0 }}>
                Sell Forever.
              </span>
              <span className={cn(
                "block transition-all duration-700 delay-500",
              )} style={mounted ? { animation: "word-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both" } : { opacity: 0 }}>
                Print Anywhere.
              </span>
            </h1>
            
            {/* Subhead */}
            <p className={cn(
              "text-xl text-muted-foreground font-medium max-w-xl transition-all duration-700",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )} style={mounted ? { animation: "float-up 0.8s ease-out 1s both" } : {}}>
              From digital design to physical product — all in one platform. 
              The marketplace, AI validation, and print network your creations deserve.
            </p>

            {/* Dual CTA */}
            <div className={cn(
              "flex flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-md",
            )} style={mounted ? { animation: "float-up 0.8s ease-out 1.2s both" } : { opacity: 0 }}>
              <Button size="lg" className="h-14 px-8 text-lg rounded-xl gap-2 shadow-lg group" asChild>
                <Link href="/register">
                  Start Creating <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-xl gap-2 border-border hover:bg-card" asChild>
                <Link href="/marketplace">
                  Explore Marketplace
                </Link>
              </Button>
            </div>
          </div>

          {/* 3D Hero Object */}
          <div className={cn(
            "h-[500px] lg:h-[600px] w-full relative transition-all duration-1000 delay-500",
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}>
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full mix-blend-screen" />
            <Hero3DObject />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         SOCIAL PROOF BAR
         ════════════════════════════════════════════════════════════ */}
      <section className="py-8 px-6 border-y border-border/50 bg-card/30">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16">
          {SOCIAL_PROOF.map((stat, i) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 text-center"
              style={mounted ? { animation: `counter-up 0.6s ease-out ${0.2 + i * 0.15}s both` } : { opacity: 0 }}
            >
              <stat.icon size={20} className="text-primary" />
              <div className="text-left">
                <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         THE 3D COMMERCE FLYWHEEL
         ════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.015]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">The Ecosystem</p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              The 3D Commerce Flywheel
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every participant makes the platform more valuable for everyone else. 
              That's how marketplaces become movements.
            </p>
          </div>
          
          {/* Flywheel — horizontal flow on mobile, circular implication on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {FLYWHEEL_STEPS.map((step, i) => (
              <div 
                key={i} 
                className="flex flex-col items-center text-center relative group"
                style={mounted ? { animation: `float-up 0.6s ease-out ${0.3 + i * 0.12}s both` } : { opacity: 0 }}
              >
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 border border-border/50 shadow-sm",
                  step.bg,
                  "group-hover:scale-110 group-hover:shadow-lg"
                )} style={{ animation: "orbit-pulse 3s ease-in-out infinite", animationDelay: `${i * 0.5}s` }}>
                  <step.icon size={32} className={step.color} />
                </div>
                <h3 className="font-bold font-display text-base mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {/* Connector arrow */}
                {i !== FLYWHEEL_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-10 -right-6 w-8">
                    <ArrowRight size={16} className="text-border" />
                  </div>
                )}
                {/* Loop arrow on last item */}
                {i === FLYWHEEL_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-10 -right-8">
                    <span className="text-primary font-bold text-xl">↺</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         THREE PERSONAS
         ════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-muted/20 border-y border-border/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Three Products, One Platform</p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Built for everyone in the ecosystem.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Three completely different experiences. One seamless platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {PERSONAS.map((persona, i) => (
              <div 
                key={persona.title} 
                className={cn(
                  "bg-card p-8 rounded-3xl border shadow-sm hover:shadow-xl transition-all group hover:-translate-y-2 duration-500 flex flex-col",
                  persona.borderColor
                )}
                style={mounted ? { animation: `float-up 0.7s ease-out ${0.2 + i * 0.15}s both` } : { opacity: 0 }}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6", persona.bg)}>
                  <persona.icon size={28} className={persona.color} />
                </div>
                <h3 className="text-2xl font-bold font-display mb-2">{persona.title}</h3>
                <p className={cn("text-lg font-medium mb-6", persona.color)}>{persona.tagline}</p>
                
                <div className="space-y-4 flex-1">
                  {persona.features.map((feat, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <feat.icon size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground font-medium">{feat.text}</p>
                    </div>
                  ))}
                </div>
                
                <Button className="w-full mt-8 rounded-xl h-12 font-semibold group/btn" variant="outline" asChild>
                  <Link href={persona.ctaHref}>
                    {persona.cta} <ArrowRight size={16} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         AI MANUFACTURING ASSISTANT TEASER
         ════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-moss/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — Copy */}
            <div>
              <p className="text-sm font-bold text-moss uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap size={14} /> Secret Weapon
              </p>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
                AI Manufacturing<br />Assistant
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Imagine uploading a model and instantly knowing its revenue potential, 
                optimal pricing, best material, and predicted print success rate. 
                Not "upload successful" — <span className="text-foreground font-semibold">upload intelligent.</span>
              </p>
              <Button size="lg" className="rounded-xl px-10 h-14 text-lg shadow-lg gap-2 group" asChild>
                <Link href="/register">
                  Upload Your First Model <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            {/* Right — AI Score Mockup */}
            <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl relative">
              <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                <Sparkles size={12} /> AI Analysis Complete
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {AI_SCORES.map((score, i) => (
                  <div 
                    key={score.label} 
                    className="bg-background/50 border border-border/50 rounded-2xl p-4 hover:bg-background/80 transition-all group/score"
                    style={mounted ? { animation: `float-up 0.5s ease-out ${1.5 + i * 0.1}s both` } : { opacity: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <score.icon size={14} className={score.color} />
                      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{score.label}</span>
                    </div>
                    <p className="text-xl font-bold font-data text-foreground group-hover/score:text-primary transition-colors">{score.value}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-border/50 flex items-center gap-3">
                <Bot size={20} className="text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-semibold">Recommendation:</span> Add 3 more photos and tag "Mechanical" for 40% more visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         THE DIFFERENTIATOR — Why not just another marketplace
         ════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-primary text-primary-foreground text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, white 0%, transparent 50%), radial-gradient(circle at 80% 70%, white 0%, transparent 50%)"
        }} />
        <div className="max-w-4xl mx-auto relative z-10">
          <p className="text-sm font-bold uppercase tracking-wider mb-6 text-primary-foreground/70">Why 3Dverse</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-8 leading-tight">
            "The marketplace isn't unique.<br />
            The AI isn't unique.<br />
            The print network isn't unique.<br />
            <span className="underline decoration-4 decoration-primary-foreground/40 underline-offset-8">The combination is.</span>"
          </h2>
          <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10">
            Nobody else connects creators, AI validation, and a distributed print 
            network into one platform. That's our moat.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" variant="secondary" className="px-10 h-14 text-lg rounded-xl font-bold" asChild>
              <Link href="/register">Join the Ecosystem</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         FAQ
         ════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-border rounded-2xl bg-card overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between font-bold text-left hover:bg-accent/50 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={cn("transition-transform shrink-0 ml-4", openFaq === i ? "rotate-180" : "")} size={20}/>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         FINAL CTA — "Every design deserves a marketplace."
         ════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-foreground text-background rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
          
          <p className="text-sm font-bold uppercase tracking-wider mb-6 text-background/50 relative z-10">The Future of 3D Commerce</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 relative z-10">Every design deserves a marketplace.</h2>
          <p className="text-xl text-background/70 mb-10 max-w-2xl mx-auto relative z-10">
            Join the ecosystem connecting digital creators, AI-powered validation, 
            distributed manufacturing, and global fulfillment.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
            <Button size="lg" variant="secondary" className="px-10 h-14 text-lg rounded-xl font-bold" asChild>
              <Link href="/register">Start as Creator</Link>
            </Button>
            <Button size="lg" variant="outline" className="px-10 h-14 text-lg rounded-xl font-bold bg-transparent border-background/20 hover:bg-background/10 text-background" asChild>
              <Link href="/register">Become a Print Partner</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
