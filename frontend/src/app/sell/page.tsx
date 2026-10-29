"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SUPPORT_EMAIL } from "@/lib/site";
import { storeCreatorType, type CreatorType } from "@/lib/creator-nav";
import { useAuthStore } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SellPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated, refreshUser } = useAuthStore();
  const [path, setPath] = useState<CreatorType | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creator = user?.role === "creator" || user?.role === "admin";
  const setUp = async () => {
    if (!path || busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await api.post<{ creator_type: CreatorType }>("/api/creator/onboarding/type", { creator_type: path });
      storeCreatorType(result.creator_type);
      await refreshUser();
      if (!["creator", "admin"].includes(useAuthStore.getState().user?.role || "")) {
        throw new Error("Your creator path was saved, but your account could not refresh. Sign in again to open the Studio.");
      }
      router.push("/creator/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not set up your creator account. Please try again.");
    } finally { setBusy(false); }
  };

  return <MarketplaceShell><div className="store-container py-12 md:py-20 max-w-4xl">
    <h1 className="font-display text-4xl font-semibold mb-5">Sell with 3DVerse</h1>
    <p className="text-lg text-muted-foreground max-w-2xl">List digital model files or finished 3D prints for customers to buy. Your shopping account stays with you when you set up a creator account.</p>
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="creator-setup">
      <h2 id="creator-setup" className="font-display text-2xl font-semibold mb-4">Set up your creator account</h2>
      {!hydrated ? <p role="status">Checking your account…</p> : !isAuthenticated ? <>
        <p className="text-muted-foreground mb-5">Sign in first, then choose how you want to sell. New accounts start as shopping accounts.</p>
        <div className="flex flex-wrap items-center gap-5"><Button asChild><Link href="/login?next=/sell">Sign in to get started</Link></Button><Link href="/register?next=/sell" className="market-text-link">Create an account</Link></div>
      </> : creator ? <Button asChild><Link href="/creator/dashboard">Open Creator Studio</Link></Button> : user?.role === "customer" ? <form className="max-w-xl space-y-5" onSubmit={event => { event.preventDefault(); void setUp(); }}>
        <div><Label htmlFor="creator-path">Creator path</Label><select id="creator-path" required value={path} onChange={event => setPath(event.target.value as CreatorType | "")} className="mt-2 w-full min-h-11 rounded-md border border-input bg-background px-3">
          <option value="">Choose how you work</option><option value="studio">Studio · I design and print</option><option value="seller">Seller · I sell my designs</option><option value="designer">Designer · I work with print partners</option>
        </select></div>
        <p className="text-sm text-muted-foreground">This choice is saved once and cannot currently be changed in account settings. Check it before continuing. You can still shop after becoming a creator.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={!path || busy} aria-busy={busy}>{busy ? "Setting up your account…" : "Set up my creator account"}</Button>
      </form> : <p className="text-muted-foreground">Your account is set up as a print partner. Contact support if you also want to sell designs.</p>}
    </section>
    <section id="partners" className="mt-12 border-t border-border pt-8" aria-labelledby="partner-entry">
      <h2 id="partner-entry" className="font-display text-2xl font-semibold mb-4">Run a 3D print shop?</h2>
      <p className="text-muted-foreground max-w-2xl">Print partners make and ship orders. Partner access is set up separately from a shopping account. Contact us with your equipment and service area to discuss onboarding.</p>
      <div className="flex flex-wrap items-center gap-5 mt-4"><a className="market-text-link" href={`mailto:${SUPPORT_EMAIL}?subject=Print%20partner%20onboarding`}>Ask about becoming a print partner</a>{user?.role === "print_partner" && <Link href="/partner" className="market-text-link">Open partner workspace</Link>}</div>
    </section>
  </div></MarketplaceShell>;
}
