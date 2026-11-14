"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/**
 * Day/night switch. Starts from the device's colour scheme (next-themes
 * `system` default); a click stores an explicit choice that survives reloads.
 * The icon is CSS-driven (`dark:`) so it is right before hydration; the
 * switch state is read only once mounted, when the resolved theme is known.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const night = ready && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label="Night mode"
      title={night ? "Switch to day mode" : "Switch to night mode"}
      data-flow="theme"
      data-state={night ? "night" : "day"}
      onClick={() => setTheme(night ? "light" : "dark")}
      className={cn(
        "flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <Sun size={22} aria-hidden="true" className="dark:hidden" />
      <Moon size={22} aria-hidden="true" className="hidden dark:block" />
    </button>
  );
}
