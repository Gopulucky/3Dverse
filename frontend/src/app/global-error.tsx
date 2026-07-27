"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">
            500 - Server Error
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-md">
            Oops! Something went wrong on our end. We've been notified and are looking into it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => reset()} size="lg" className="gap-2">
              <RefreshCcw size={18} />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push("/")} size="lg" className="gap-2">
              <Home size={18} />
              Go to Home
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
