"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read the token off the URL at submit time rather than via useSearchParams,
    // which would force this page behind a Suspense boundary.
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      toast.error("This reset link is incomplete. Request a new one.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/reset-password", { token, new_password: password });
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err?.detail || "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password" className="mb-2 block">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm" className="mb-2 block">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : "Update password"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Link expired?{" "}
          <Link href="/forgot-password" className="text-primary hover:underline font-medium">
            Request a new one
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
