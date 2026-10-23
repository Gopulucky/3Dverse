"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { AuthCard } from "@/components/layout/auth-card";

type State = "working" | "ok" | "failed";

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("failed");
      return;
    }
    api
      .post("/api/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch(() => setState("failed"));
  }, []);

  return (
    <AuthCard title="Email verification">
      <div className="text-center space-y-4">
        {state === "working" && (
          <>
            <Loader2 className="mx-auto animate-spin text-muted-foreground" size={36} />
            <p className="text-sm text-muted-foreground">Verifying your email…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto text-success" size={40} />
            <p className="text-sm text-muted-foreground">Your email is verified. Thank you!</p>
            <Link href="/marketplace" className="text-primary hover:underline text-sm font-medium">
              Continue to the marketplace
            </Link>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="mx-auto text-destructive" size={40} />
            <p className="text-sm text-muted-foreground">
              This verification link is invalid or has expired. Sign in and request a new one from Settings.
            </p>
            <Link href="/login" className="text-primary hover:underline text-sm font-medium">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}
