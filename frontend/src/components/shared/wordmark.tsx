import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The 3DVerse wordmark. Single source so the navbar, footer, and
 * marketing pages never drift from the "3D" + "Verse" split.
 */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl sm:text-5xl",
  }[size];

  return (
    <span className={cn("font-bold tracking-tight font-display", sizeClass, className)}>
      <span className="text-gradient-primary">{BRAND.wordmark.lead}</span>
      <span className="text-foreground">{BRAND.wordmark.tail}</span>
    </span>
  );
}
