"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const MISSING_LABEL: Record<string, string> = {
  capabilities: "At least one capability",
  lead_time_days: "Lead time",
  price_per_gram_inr: "Price per gram",
  build_volume: "Build volume",
};

/**
 * "Accepting work / Paused" switch. It stays off, with a list of what is missing,
 * until the profile is complete (the server enforces the same rule).
 */
export function AvailabilitySwitch({ accepting, missing, busy, onToggle, onOpenProfile }: {
  accepting: boolean;
  missing: string[];
  busy: boolean;
  onToggle: (next: boolean) => void;
  onOpenProfile: () => void;
}) {
  const blocked = !accepting && missing.length > 0;
  return (
    <div data-flow="partner-availability" data-state={accepting ? "accepting" : blocked ? "blocked" : "paused"} className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">{accepting ? "Accepting work" : "Paused"}</p>
          <p className="text-sm text-muted-foreground">
            {accepting ? "Creators can find you and send requests." : "Creators can't see you until you switch this on."}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={accepting} aria-label="Accepting work" disabled={blocked || busy}
          onClick={() => onToggle(!accepting)}
          className={cn("relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border border-border px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            accepting ? "bg-moss" : "bg-muted")}>
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-background shadow transition-transform", accepting && "translate-x-9")}>
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          </span>
        </button>
      </div>
      {blocked && (
        <div className="mt-3 text-sm">
          <p className="font-medium">Finish your profile to start accepting work:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {missing.map(key => <li key={key}>{MISSING_LABEL[key] ?? key}</li>)}
          </ul>
          <button type="button" onClick={onOpenProfile} className="mt-2 inline-flex min-h-11 items-center text-moss underline">Open your profile</button>
        </div>
      )}
    </div>
  );
}
