import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The buy&sell3d logo: the name alone, no symbol. Single source so the navbar,
 * footer, and marketing pages never drift. Only the "&" is coloured (Tangerine);
 * the rest is ink, so the name never depends on the accent to be read.
 *
 * `tone="inverse"` is for dark panels (ink flips to the page colour).
 */
export function Wordmark({
  className,
  size = "md",
  tone = "default",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "inverse";
}) {
  const sizeClass = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl sm:text-5xl",
  }[size];
  const ink = tone === "inverse" ? "text-background" : "text-foreground";
  const { before, accent, after } = BRAND.wordmark;

  return (
    <span className={cn("font-bold tracking-tight font-display normal-case", sizeClass, className)}>
      <span className={ink}>{before}</span>
      <span className="wordmark-amp">{accent}</span>
      <span className={ink}>{after}</span>
    </span>
  );
}
