"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-8">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-md">
          We've encountered an unexpected error while loading this page. Our team has been notified.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={() => reset()} size="lg" className="gap-2">
            <RefreshCcw size={18} />
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
              <Home size={18} />
              Go Home
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
