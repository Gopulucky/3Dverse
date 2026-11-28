"use client";

import { useReducer, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, API_URL, ApiError } from "@/lib/api";
import { firebaseConfigured, firebaseAuth, googleSignIn, emailSignIn, signInError } from "@/lib/firebase";
import { useAuthStore, type User } from "@/stores/auth-store";
import { useCountry, useRegionStore } from "@/stores/region-store";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/region";
import { AuthCard } from "@/components/layout/auth-card";
import { authReducer, initialAuthState, isLegacy } from "@/lib/machines/customer-auth";
import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const subscribe = () => () => {};

/** Why someone who was sent here from a private page is seeing a sign-in form. */
const REASONS: Record<string, string> = {
  "/cart": "Sign in to view your cart and unlocked files.",
  "/orders": "Sign in to view your orders and downloads.",
  "/wishlist": "Sign in to view your wishlist.",
};

/** Google's own "G", in its brand colours. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** A password field with a button to check what was typed. */
function PasswordInput(props: InputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-12" />
      <button type="button" onClick={() => setShown((value) => !value)} aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
        {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function CustomerAuth({ create = false }: { create?: boolean }) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const country = useCountry();
  const setCountry = useRegionStore((state) => state.setCountry);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const reason = REASONS[new URLSearchParams(search).get("next") ?? ""];
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
        {reason && <p role="status" className="rounded-lg bg-primary-surface px-3 py-2 text-center text-sm text-primary-ink">{reason}</p>}
        <Button type="button" variant="outline" className="w-full" disabled={busy || !firebaseConfigured} onClick={google}><GoogleIcon />Continue with Google</Button>
        {!firebaseConfigured && <p className="text-xs text-muted-foreground text-center">Google sign-in is currently unavailable. Use email below.</p>}
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px bg-border flex-1" />or use email<span className="h-px bg-border flex-1" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form onSubmit={submit} className="space-y-4" data-ready={ready} data-flow="customer-auth" data-state={auth.status} data-auth-mode={auth.mode.kind}>
          {pendingLink ? <>
            <Label htmlFor="previous-password">Previous buy&sell3d password</Label>
            <PasswordInput id="previous-password" autoComplete="current-password" required value={previousPassword} onChange={(e) => setPreviousPassword(e.target.value)} />
          </> : <>
            <div><Label htmlFor="email" className="mb-2 block">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div><div className="flex justify-between mb-2"><Label htmlFor="password">Password</Label>{!create && <Link href={`/forgot-password${legacy ? "?previous=1" : ""}`} className="text-xs text-primary underline">Forgot password?</Link>}</div>
              <PasswordInput id="password" minLength={create ? 8 : 1} maxLength={128} autoComplete={create ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
              {create && <p className="text-xs text-muted-foreground mt-1">Use at least 8 characters.</p>}
            </div>
            {create && <div><Label htmlFor="confirm-password" className="mb-2 block">Confirm password</Label><PasswordInput id="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>}
            {create && <div><Label htmlFor="signup-country" className="mb-2 block">Country</Label>
              <select id="signup-country" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full min-h-11 rounded-lg border border-input bg-card px-3 text-sm">
                {COUNTRIES.map((option) => <option key={option.code} value={option.code}>{option.name} ({option.currency})</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Prices are shown in this currency as an estimate. Orders are charged in INR.</p>
            </div>}
          </>}
          <Button type="submit" className="w-full" size="lg" disabled={busy || !ready}>{busy ? <Loader2 className="animate-spin" size={18} /> : pendingLink ? "Connect my account" : create ? "Create my account" : "Sign in with email"}</Button>
        </form>
        {!create && firebaseConfigured && <button type="button" className="text-xs text-primary underline" disabled={busy} onClick={() => dispatch({ type: "TOGGLE_LEGACY" })}>{legacy ? "Back to Google or email sign-in" : "Account made before Google sign-in? Use your old password"}</button>}
        {legacy && <p className="text-xs text-muted-foreground">Enter the email and password you used before.</p>}
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
