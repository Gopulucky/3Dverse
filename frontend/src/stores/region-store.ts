"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { DEFAULT_COUNTRY, readCountry } from "@/lib/region";

const KEY = "bs3d-country";

interface RegionState {
  country: string;
  hydrated: boolean;
  /** Read the saved choice once, on the client. Idempotent. */
  hydrate: () => void;
  /** Use a country without saving it to the account (e.g. the account already has it). */
  adopt: (code: string | null | undefined) => void;
  /** The shopper picked a country: remember it here and, when signed in, on their account. */
  setCountry: (code: string) => void;
}

function remember(code: string) {
  try { localStorage.setItem(KEY, code); } catch { /* private mode: the choice just lasts this visit */ }
}

export const useRegionStore = create<RegionState>((set, get) => ({
  country: DEFAULT_COUNTRY,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined" || get().hydrated) return;
    let saved: string | undefined;
    try { saved = readCountry(localStorage.getItem(KEY)); } catch { saved = undefined; }
    set({ country: saved ?? get().country, hydrated: true });
  },

  adopt: (code) => {
    const country = readCountry(code);
    if (!country) return;
    remember(country);
    set({ country, hydrated: true });
  },

  setCountry: (code) => {
    const country = readCountry(code);
    if (!country) return;
    remember(country);
    set({ country, hydrated: true });
    let signedIn = false;
    try { signedIn = Boolean(localStorage.getItem("token")); } catch { /* ignore */ }
    // Best effort: the display already changed, so a failed save must not interrupt shopping.
    if (signedIn) void api.put("/api/users/me", { country }).catch(() => {});
  },
}));

/** The shopper's country; prices follow it. Reads the saved choice after the first render. */
export function useCountry(): string {
  const country = useRegionStore((state) => state.country);
  const hydrate = useRegionStore((state) => state.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return country;
}
