"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Store, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Where creator-account requests go. Update when a real support desk exists. */
const SELLER_CONTACT = "sellers@3dverse.com";

/**
 * "Sell with 3Dverse" entry point.
 *
 * Creator accounts are approved manually, so this resolves three ways:
 *   - creator/admin  → straight into the Studio
 *   - signed out     → sign in first; we can't tell what account they hold
 *   - everyone else  → explain the approval process and how to request access
 */
export function SellWith3DverseLink({ className }: { className?: string }) {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const [askOpen, setAskOpen] = useState(false);

  const isCreator = user?.role === "creator" || user?.role === "admin";

  // Until localStorage is read, every visitor looks signed out. Render the
  // plain link so the label never flickers, and decide on click instead.
  const handleClick = (e: React.MouseEvent) => {
    if (!hydrated) return;
    if (isCreator) return; // let the Link navigate

    e.preventDefault();
    if (!isAuthenticated) {
      router.push("/login?next=/creator/dashboard");
      return;
    }
    setAskOpen(true);
  };

  return (
    <>
      <Link
        href="/creator/dashboard"
        onClick={handleClick}
        className={cn(
          "text-sm font-bold text-primary hover:text-primary/80 whitespace-nowrap transition-colors",
          className
        )}
      >
        Sell with 3Dverse
      </Link>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              <Store size={24} className="text-primary" />
            </div>
            <DialogTitle className="text-xl">Start selling on 3DVerse</DialogTitle>
            <DialogDescription className="pt-1">
              You&apos;re signed in as a customer. Selling needs a separate creator
              account, and those are reviewed and approved by our team before they
              go live.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              What to include in your request
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>The email on this account ({user?.email})</li>
              <li>Whether you own a 3D printer</li>
              <li>A link to your portfolio or past work</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAskOpen(false)}>
              Not now
            </Button>
            <Button asChild>
              <a
                href={`mailto:${SELLER_CONTACT}?subject=${encodeURIComponent(
                  "Creator account request"
                )}&body=${encodeURIComponent(
                  `Account email: ${user?.email ?? ""}\nDo you own a 3D printer: \nPortfolio link: \n`
                )}`}
              >
                <Mail size={16} className="mr-2" />
                Request access
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
