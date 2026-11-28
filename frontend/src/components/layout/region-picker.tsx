"use client";

import { Globe } from "lucide-react";
import { COUNTRIES, countryLabel, currencyForCountry } from "@/lib/region";
import { useAuthStore } from "@/stores/auth-store";
import { useCountry, useRegionStore } from "@/stores/region-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/** "Where are you shopping from?": the same panel wherever it is opened from. */
function RegionDialogContent() {
  const country = useCountry();
  const setCountry = useRegionStore((state) => state.setCountry);

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Where are you shopping from?</DialogTitle>
        <DialogDescription>
          Prices are shown in your currency as an estimate. Every order is charged in Indian rupees (INR).
        </DialogDescription>
      </DialogHeader>
      <div>
        <Label htmlFor="region-country" className="mb-2 block">Country</Label>
        <select
          id="region-country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="w-full min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>{option.name} ({option.currency})</option>
          ))}
        </select>
      </div>
    </DialogContent>
  );
}

/** Opened from the account menu, which closes first, so it has no button of its own. */
export function RegionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RegionDialogContent />
    </Dialog>
  );
}

/**
 * The country setting in the footer, for signed-out visitors, who have no account
 * menu. Signed-in shoppers change it from that menu instead.
 */
export function RegionPicker() {
  const country = useCountry();
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const currency = currencyForCountry(country);

  if (signedIn) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Country and currency: ${countryLabel(country)}, ${currency}. Change`}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Globe size={20} aria-hidden="true" />
          <span>Prices shown for {countryLabel(country)} ({currency})</span>
        </button>
      </DialogTrigger>
      <RegionDialogContent />
    </Dialog>
  );
}
