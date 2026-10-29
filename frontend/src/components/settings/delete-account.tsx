"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { reauthenticateFirebase, signInError } from "@/lib/firebase";

/**
 * Danger zone — self-service account deletion, shown in every portal's settings.
 *
 * Deletion deactivates the account rather than erasing it: order history stays
 * intact and the email cannot be re-registered. It is also the only way out of
 * a locked creator path, so the consequences are spelled out explicitly.
 */
export function DeleteAccountCard({
  email,
  note,
}: {
  email: string;
  note?: string;
}) {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const firebase = user?.auth_provider === "firebase";
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const firebase_id_token = firebase ? await reauthenticateFirebase(password) : undefined;
      return api.delete("/api/users/me", { password, confirm_email: confirmEmail, firebase_id_token });
    },
    onSuccess: () => {
      toast.success("Account deleted. Signing you out…");
      logout();
      router.push("/");
    },
    onError: (error: unknown) => toast.error(signInError(error)),
  });

  const canSubmit =
    confirmEmail.trim().toLowerCase() === email.toLowerCase() && (firebase || password.length > 0);

  return (
    <Card className="p-6 border-danger-red/40 mt-8">
      <h2 className="text-lg font-bold mb-1 font-display flex items-center gap-2 text-destructive">
        <AlertTriangle size={18} />
        Delete Account
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Your account is deactivated and you are signed out immediately. Your order
        history is retained for records, and this email address cannot be used to
        register again — contact support if you need it restored.
        {note ? ` ${note}` : ""}
      </p>

      {!open ? (
        <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      ) : (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <Label className="mb-2 block">
              Type <span className="font-data text-foreground">{email}</span> to confirm
            </Label>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="mb-2 block">{firebase ? "Email password (leave blank for Google sign-in)" : "Your password"}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {firebase && <p className="text-xs text-muted-foreground mt-2">Confirm your sign-in to delete your account. Google users will see a confirmation window.</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setConfirmEmail("");
                setPassword("");
              }}
              disabled={deleteAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-danger-red/50"
              disabled={!canSubmit || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
