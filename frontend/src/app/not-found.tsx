import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center pt-24 pb-20">
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="w-32 h-32 bg-card border border-border shadow-lg rounded-full flex items-center justify-center relative z-10 mx-auto group-hover:scale-105 transition-transform duration-500">
            <Compass size={64} className="text-primary animate-pulse" />
          </div>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-display font-bold text-foreground mb-4 tracking-tighter">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
          Lost in the 3Dverse
        </h2>
        <p className="text-muted-foreground text-lg mb-10 max-w-md">
          The page or model you're looking for doesn't exist, has been moved, or is currently unavailable.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/marketplace/home">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              <Home size={18} />
              Return to Marketplace
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
              <Search size={18} />
              Browse Models
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
