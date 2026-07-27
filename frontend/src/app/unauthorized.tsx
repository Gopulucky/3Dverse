import Link from "next/link";
import { Lock, Home, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center pt-24 pb-20">
        <div className="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-8">
          <Lock size={48} />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
          Access Denied
        </h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-md">
          You don't have permission to view this page. Please log in with an account that has the required access.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              <LogIn size={18} />
              Log In
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
              <Home size={18} />
              Return Home
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
