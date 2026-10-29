"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getQueryClient } from "@/lib/query-client";
import { useCartStore } from "@/stores/cart-store";

let sessionGeneration = 0;

export interface User {
  id: number;
  email: string;
  role: "creator" | "customer" | "print_partner" | "admin";
  full_name?: string;
  auth_provider?: "password" | "firebase";
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /** True once localStorage has been read on the client. Redirect decisions
   *  must wait for this — otherwise every full page load bounces to /login. */
  hydrated: boolean;

  setAuth: (token: string, user: User, provider?: "password" | "firebase") => void;
  logout: () => void;
  hydrate: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,

  setAuth: (token: string, user: User, provider = "password") => {
    sessionGeneration += 1;
    getQueryClient().clear();
    useCartStore.getState().setItemCount(0);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("auth_provider", provider);
    set({ token, user, isAuthenticated: true, hydrated: true });
  },

  logout: () => {
    sessionGeneration += 1;
    getQueryClient().clear();
    useCartStore.getState().setItemCount(0);
    const provider = localStorage.getItem("auth_provider");
    if (provider === "firebase") void import("@/lib/firebase").then((sdk) => sdk.firebaseSignOut()).catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("auth_provider");
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    sessionGeneration += 1;
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true, hydrated: true });
        // The cached copy can go stale the moment a role/profile changes
        // server-side (e.g. an admin promotion done directly in the DB) --
        // nothing previously re-checked it after login. Refresh in the
        // background so a stale role doesn't hide portals/pages until the
        // next manual logout+login.
        void get().refreshUser();
        return;
      } catch {
        // fall through
      }
    }
    set({ token: null, user: null, isAuthenticated: false, hydrated: true });
  },

  refreshUser: async () => {
    const { token } = get();
    const generation = sessionGeneration;
    if (!token) return;
    try {
      const fresh = await api.get<{
        id: number;
        email: string;
        role: User["role"];
        full_name?: string;
        auth_provider?: "password" | "firebase";
      }>("/api/users/me");
      if (generation !== sessionGeneration) return;
      const user: User = {
        id: fresh.id,
        email: fresh.email,
        role: fresh.role,
        full_name: fresh.full_name,
        auth_provider: fresh.auth_provider,
      };
      localStorage.setItem("user", JSON.stringify(user));
      set({ user });
    } catch (err) {
      if (generation !== sessionGeneration) return;
      // An expired/invalidated token (e.g. password changed elsewhere,
      // bumping token_version) should sign the user out instead of leaving
      // them stuck with a token the API will keep rejecting.
      if (err instanceof ApiError && err.status === 401) {
        get().logout();
      }
      // Any other failure (offline, backend down) -- keep the cached user,
      // don't fight the user's session over a transient network error.
    }
  },
}));

/**
 * Gate a page behind authentication without the hydration race.
 * Returns `ready` (safe to render private content) — pages should render
 * a skeleton or null until it is true.
 */
export function useRequireAuth(redirectTo: string = "/login") {
  const router = useRouter();
  const { isAuthenticated, hydrated, user, hydrate } = useAuthStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [hydrated, isAuthenticated, router, redirectTo]);

  return { ready: hydrated && isAuthenticated, isAuthenticated, user };
}

/**
 * Gate a page behind a specific user role.
 * Redirects to /marketplace/home if authenticated but wrong role.
 * Redirects to /login if not authenticated at all.
 */
export function useRequireRole(
  allowedRoles: Array<"creator" | "customer" | "print_partner" | "admin">,
  redirectTo: string = "/marketplace/home"
) {
  const router = useRouter();
  const { isAuthenticated, hydrated, user, hydrate } = useAuthStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !allowedRoles.includes(user.role)) {
      router.push(redirectTo);
    }
  }, [hydrated, isAuthenticated, user, router, redirectTo]);

  const hasAccess = hydrated && isAuthenticated && !!user && allowedRoles.includes(user.role);
  return { ready: hasAccess, user };
}
