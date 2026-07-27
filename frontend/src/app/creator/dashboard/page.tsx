"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioShell } from "@/components/layout/studio-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock } from "lucide-react";
import SelfFulfillingDashboard from "@/components/creator/SelfFulfillingDashboard";
import DesignerOnlyDashboard from "@/components/creator/DesignerOnlyDashboard";
import {
  CREATOR_PATHS,
  type CreatorType,
  normaliseCreatorType,
  readStoredCreatorType,
  storeCreatorType,
} from "@/lib/creator-nav";
import { cn } from "@/lib/utils";

export default function CreatorDashboardPage() {
  const { ready: isAuthenticated } = useRequireRole(["creator", "admin"]);
  const [creatorType, setCreatorType] = useState<CreatorType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<CreatorType | null>(null);
  const [confirming, setConfirming] = useState<CreatorType | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Render immediately from the cached value, then reconcile with the server,
    // which is authoritative — the path is locked there, not in the browser.
    setCreatorType(readStoredCreatorType());

    api
      .get<{ creator_type: string | null }>("/api/creator/onboarding/status")
      .then((res) => {
        const serverType = normaliseCreatorType(res.creator_type);
        setCreatorType(serverType);
        if (serverType) storeCreatorType(serverType);
      })
      .catch(() => {
        // Offline or unauthorised: fall back to whatever the browser cached.
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const choosePath = async (type: CreatorType) => {
    setPending(type);
    try {
      const res = await api.post<{ creator_type: string }>(
        "/api/creator/onboarding/type",
        { creator_type: type }
      );
      const saved = normaliseCreatorType(res.creator_type) || type;
      storeCreatorType(saved);
      setCreatorType(saved);
      toast.success(`You're set up as a ${saved} creator.`);
    } catch (e: any) {
      // 409 means it was already set server-side — adopt that value instead of
      // leaving the user staring at a chooser they can no longer use.
      toast.error(e?.detail || "Could not set your creator path");
      try {
        const status = await api.get<{ creator_type: string | null }>(
          "/api/creator/onboarding/status"
        );
        const serverType = normaliseCreatorType(status.creator_type);
        if (serverType) {
          storeCreatorType(serverType);
          setCreatorType(serverType);
        }
      } catch {
        // leave the chooser up
      }
    } finally {
      setPending(null);
      setConfirming(null);
    }
  };

  if (!isAuthenticated || isLoading) {
    return (
      <StudioShell>
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </StudioShell>
    );
  }

  if (!creatorType) {
    return (
      <StudioShell>
        <div className="w-full max-w-6xl mx-auto px-6 pt-20 pb-24">
          <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-4xl font-bold font-display mb-4">Choose Your Creator Path</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              How do you want to operate on 3DVerse? This shapes your studio tools and
              which features you get.
            </p>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-4 flex items-center justify-center gap-2">
              <Lock size={14} className="text-ember" />
              <span>
                This choice is <strong className="text-foreground">permanent</strong>. To
                switch later you'd have to delete your account and start again.
              </span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {CREATOR_PATHS.map((p) => {
              const isConfirming = confirming === p.type;
              return (
                <Card
                  key={p.type}
                  className={cn(
                    "p-8 border-border bg-card transition-all flex flex-col text-center group",
                    isConfirming ? "border-ember" : "hover:border-primary/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto transition-transform group-hover:scale-110",
                      p.accentBg
                    )}
                  >
                    <p.icon size={32} className={p.accent} />
                  </div>
                  <h2 className="text-2xl font-bold font-display mb-1">{p.label}</h2>
                  <p className={cn("text-sm font-semibold mb-3", p.accent)}>{p.tagline}</p>
                  <p className="text-muted-foreground mb-6 text-sm">{p.description}</p>
                  <ul className="text-sm text-left w-full space-y-2 mb-6 text-muted-foreground">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex gap-2 items-start">
                        <span className={p.accent}>✓</span>
                        {b}
                      </li>
                    ))}
                    <li className="flex gap-2 items-start">
                      <span className={p.canCollaborate ? p.accent : "opacity-40"}>
                        {p.canCollaborate ? "✓" : "✕"}
                      </span>
                      <span className={p.canCollaborate ? "" : "opacity-60"}>
                        {p.canCollaborate
                          ? "Collaborate with print partners"
                          : "No print partner collaboration"}
                      </span>
                    </li>
                  </ul>

                  {isConfirming ? (
                    <div className="mt-auto space-y-2">
                      <p className="text-xs text-ember font-semibold">
                        Lock in {p.label} permanently?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setConfirming(null)}
                          disabled={pending === p.type}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => choosePath(p.type)}
                          disabled={pending === p.type}
                        >
                          {pending === p.type ? "Saving…" : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full mt-auto"
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() => setConfirming(p.type)}
                    >
                      Choose {p.label} <ArrowRight size={16} className="ml-2" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </StudioShell>
    );
  }

  // Studio and Seller both run the seller-style dashboard (inventory + orders);
  // Designer gets the portfolio/royalty view.
  if (creatorType === "designer") return <DesignerOnlyDashboard />;
  return <SelfFulfillingDashboard />;
}
