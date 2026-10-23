"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      toast.error(err?.detail || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="text-center space-y-4">
          <MailCheck className="mx-auto text-success" size={40} />
          <p className="text-sm text-muted-foreground">
            If <span className="text-foreground font-medium">{email}</span> has an account, we have sent a
            link to reset the password. It works once and expires in an hour.
          </p>
          <Link href="/login" className="text-primary hover:underline text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we will send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-2 block">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy || !email}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : "Send reset link"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline font-medium">Back to sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
