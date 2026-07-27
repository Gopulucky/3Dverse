"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  role: "creator" | "customer" | "print_partner" | "admin";
  full_name?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /** True once localStorage has been read on the client. Redirect decisions
   *  must wait for this — otherwise every full page load bounces to /login. */
  hydrated: boolean;

  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,

  setAuth: (token: string, user: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true, hydrated: true });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true, hydrated: true });
        return;
      } catch {
        // fall through
      }
    }
    set({ token: null, user: null, isAuthenticated: false, hydrated: true });
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
