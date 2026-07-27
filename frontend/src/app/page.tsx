"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { ArrowRight, Download, Printer, Palette, Sparkles, Box, Settings } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated && mounted) {
      router.replace("/marketplace/home");
    }
  }, [isAuthenticated, mounted, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      router.push(`/register?email=${encodeURIComponent(email)}`);
    } else {
      router.push("/register");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-x-hidden">
      <Navbar />

      {/* Modern, Vibrant Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Abstract Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-full pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] mix-blend-multiply" />
          <div className="absolute top-[10%] -right-[10%] w-[600px] h-[600px] rounded-full bg-ember/15 blur-[120px] mix-blend-multiply" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div 
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-surface text-primary-ink text-sm font-semibold mb-8 transition-all duration-700",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <Sparkles size={16} /> Welcome to the future of fabrication
          </div>
          
          <h1
            className={cn(
              "text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground font-display leading-[1.1] mb-8 transition-all duration-700 delay-100",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Digital designs.<br />
            <span className="text-gradient-primary">Physical reality.</span>
          </h1>
          
          <p
            className={cn(
              "text-xl sm:text-2xl text-muted-foreground font-medium mb-12 max-w-2xl mx-auto transition-all duration-700 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Discover, customize, and print premium 3D models from world-class creators. Delivered straight to your door or downloaded instantly.
          </p>

          <form 
            onSubmit={handleGetStarted}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center max-w-xl mx-auto gap-3 transition-all duration-700 delay-300",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="relative w-full h-14 bg-card border border-border rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <input 
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-full bg-transparent text-foreground px-5 outline-none text-base font-medium rounded-xl"
              />
            </div>
            
            <Button 
              type="submit"
              size="lg"
              className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl gap-2 shadow-md group"
            >
              Get Started <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-surface/50 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">Everything you need to create</h2>
             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">3DVerse provides a seamless ecosystem connecting designers, consumers, and print facilities.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-primary-surface text-primary-ink rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Download size={28} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4 font-display">Instant Downloads</h3>
              <p className="text-muted-foreground leading-relaxed">Purchase premium STL files and start printing immediately on your own hardware.</p>
            </div>

            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-success-surface text-success-ink rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Printer size={28} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4 font-display">Professional Printing</h3>
              <p className="text-muted-foreground leading-relaxed">No printer? Send orders to our global network of print partners for high-quality, doorstep delivery.</p>
            </div>

            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-warning-surface text-warning-ink rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Palette size={28} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4 font-display">Creator Studio</h3>
              <p className="text-muted-foreground leading-relaxed">Monetize your designs. Set custom pricing, manage variants, and build your brand on 3DVerse.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-foreground text-background rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden">
          {/* Abstract elements inside dark card */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-ember/20 rounded-full blur-3xl" />
          
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 relative z-10">Join the revolution.</h2>
          <p className="text-xl text-background/80 mb-10 max-w-2xl mx-auto relative z-10">
            Whether you're a hobbyist, a professional designer, or a print farm operator, there's a place for you here.
          </p>
          <Button size="lg" variant="secondary" className="px-10 h-14 text-lg rounded-xl font-bold relative z-10" onClick={() => router.push('/register')}>
            Create your account
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
