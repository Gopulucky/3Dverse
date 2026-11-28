"use client";

import { useReducer, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, API_URL, ApiError } from "@/lib/api";
import { firebaseConfigured, firebaseAuth, googleSignIn, emailSignIn, signInError } from "@/lib/firebase";
import { useAuthStore, type User } from "@/stores/auth-store";
import { useCountry, useRegionStore } from "@/stores/region-store";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/region";
import { AuthCard } from "@/components/layout/auth-card";
import { authReducer, initialAuthState, isLegacy } from "@/lib/machines/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const subscribe = () => () => {};

export function CustomerAuth({ create = false }: { create?: boolean }) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const country = useCountry();
  const setCountry = useRegionStore((state) => state.setCountry);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [previousPassword, setPreviousPassword] = useState("");
  const [auth, dispatch] = useReducer(authReducer, initialAuthState);
  const pendingLink = auth.mode.kind === "link";
  const legacy = isLegacy(auth);
  const busy = auth.status !== "idle";
  const error = auth.error;

  function finish(token: string, user: User, provider: "firebase" | "password") {
    setAuth(token, user, provider);
    // Save the country picked on this form (or earlier in the header) to the new account.
    // Best effort: a failure here must not get in the way of signing in.
    const chosen = useRegionStore.getState().country;
    if (!user.country && (create || chosen !== DEFAULT_COUNTRY)) void api.put("/api/users/me", { country: chosen }).catch(() => {});
    dispatch({ type: "DONE" });
    const next = new URLSearchParams(window.location.search).get("next");
    const safe = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !/[\u0000-\u001f]/.test(next);
    router.push(safe ? next! : "/marketplace/home");
    toast.success(create ? "Your account is ready. Check your email to verify your address." : "You’re signed in.");
  }

  async function completeFirebase(token: string) {
    try {
      const user = await api.post<User>("/api/auth/firebase", { id_token: token });
      finish(token, user, "firebase");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        dispatch({ type: "LINK_REQUIRED", message: "Already shopped here? Verify your email, then enter your previous buy&sell3d password below to connect your account and keep your orders." });
        return;
      }
      throw err;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (auth.status !== "idle") return;
    dispatch({ type: "SUBMIT" });
    try {
      if (pendingLink) {
        const current = (await firebaseAuth()).currentUser;
        if (!current) throw new Error("Please sign in again");
        await current.reload();
        const token = await current.getIdToken(true);
        const user = await api.post<User>("/api/auth/firebase/link", { id_token: token, previous_password: previousPassword });
        finish(token, user, "firebase");
      } else if (firebaseConfigured && !legacy) {
        if (create && password !== confirm) { dispatch({ type: "FAILED", error: "Your passwords don’t match." }); return; }
        const credential = await emailSignIn(email.trim(), password, create);
        await completeFirebase(await credential.user.getIdToken());
      } else if (create) {
        if (password !== confirm) { dispatch({ type: "FAILED", error: "Your passwords don’t match." }); return; }
        await api.post("/api/auth/register", { email: email.trim(), password, role: "customer", country });
        dispatch({ type: "DONE" });
        toast.success("Account created. Check your email, then sign in."); router.push(`/login${window.location.search}`);
      } else {
        const res = await fetch(`${API_URL}/api/auth/login/access-token`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username: email.trim(), password }),
        });
        const result = await res.json();
        if (!res.ok) { dispatch({ type: "FAILED", error: result.detail || "Check your email and password." }); return; }
        finish(result.access_token, result.user, "password");
      }
    } catch (err) { dispatch({ type: "FAILED", error: signInError(err) }); }
  }

  async function google() {
    if (auth.status !== "idle") return;
    dispatch({ type: "SUBMIT" });
    try {
      const credential = await googleSignIn();
      await completeFirebase(await credential.user.getIdToken());
    } catch (err) { dispatch({ type: "FAILED", error: signInError(err) }); }
  }

  return (
    <AuthCard title={create ? "Your buy&sell3d account" : "Sign in to buy&sell3d"}
      description={create ? "One account to buy printed products and 3D files. No printer needed to shop printed products." : "Track your orders and access your purchased 3D files."}>
      <div className="space-y-5">
        <Button type="button" variant="outline" className="w-full" disabled={busy || !firebaseConfigured} onClick={google}>Continue with Google</Button>
        {!firebaseConfigured && <p className="text-xs text-muted-foreground text-center">Google sign-in is currently unavailable. Use email below.</p>}
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px bg-border flex-1" />or use email<span className="h-px bg-border flex-1" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form onSubmit={submit} className="space-y-4" data-ready={ready} data-flow="customer-auth" data-state={auth.status} data-auth-mode={auth.mode.kind}>
          {pendingLink ? <>
            <Label htmlFor="previous-password">Previous buy&sell3d password</Label>
            <Input id="previous-password" type="password" autoComplete="current-password" required value={previousPassword} onChange={(e) => setPreviousPassword(e.target.value)} />
          </> : <>
            <div><Label htmlFor="email" className="mb-2 block">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div><div className="flex justify-between mb-2"><Label htmlFor="password">Password</Label>{!create && <Link href={`/forgot-password${legacy ? "?previous=1" : ""}`} className="text-xs text-primary underline">Forgot password?</Link>}</div>
              <Input id="password" type="password" minLength={create ? 8 : 1} maxLength={128} autoComplete={create ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
              {create && <p className="text-xs text-muted-foreground mt-1">Use at least 8 characters.</p>}
            </div>
            {create && <div><Label htmlFor="confirm-password" className="mb-2 block">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>}
            {create && <div><Label htmlFor="signup-country" className="mb-2 block">Country</Label>
              <select id="signup-country" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full min-h-11 rounded-full border border-input bg-background px-4 text-sm">
                {COUNTRIES.map((option) => <option key={option.code} value={option.code}>{option.name} ({option.currency})</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Prices are shown in this currency as an estimate. Orders are charged in INR.</p>
            </div>}
          </>}
          <Button type="submit" className="w-full" size="lg" disabled={busy || !ready}>{busy ? <Loader2 className="animate-spin" size={18} /> : pendingLink ? "Connect my account" : create ? "Create my account" : "Sign in with email"}</Button>
        </form>
        {!create && firebaseConfigured && <button type="button" className="text-xs text-primary underline" disabled={busy} onClick={() => dispatch({ type: "TOGGLE_LEGACY" })}>{legacy ? "Use Google or current email sign-in" : "Use my previous buy&sell3d sign-in"}</button>}
        {legacy && <p className="text-xs text-muted-foreground">For accounts created before Google sign-in was introduced.</p>}
        <p className="text-sm text-center text-muted-foreground">{create ? "Already have an account? " : "New to buy&sell3d? "}<Link href={create ? "/login" : "/register"} onClick={(event) => { event.preventDefault(); router.push(`${create ? "/login" : "/register"}${window.location.search}`); }} className="text-primary underline">{create ? "Sign in" : "Create an account"}</Link></p>
        {create && <p className="text-xs text-muted-foreground text-center">By creating an account, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>}
        <div className="border-t border-border pt-4 flex flex-col gap-3 text-center text-sm">
          <Link href="/marketplace" className="text-primary underline">Keep browsing without an account</Link>
          {create && <Link href="/sell" className="text-muted-foreground underline">Want to sell your designs?</Link>}
        </div>
      </div>
    </AuthCard>
  );
}
