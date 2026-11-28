import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * The buy&sell3d logo: the name alone, no symbol. Single source so the navbar,
 * footer, and marketing pages never drift. The name is Space Grotesk; the "&" is
 * Inter, because Space Grotesk's own ampersand reads like an 8 when small. Only
 * the "&" is coloured (Tangerine), so the name never depends on the accent to be
 * read. At `size="lg"` the "&" is drawn as printed layers (globals.css).
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
    md: "text-xl min-[26rem]:text-[1.625rem]",
    lg: "text-4xl sm:text-5xl",
  }[size];
  const ink = tone === "inverse" ? "text-background" : "text-foreground";
  const { before, accent, after } = BRAND.wordmark;

  return (
    <span className={cn("wordmark font-bold tracking-[-0.035em] font-display normal-case whitespace-nowrap", size === "lg" && "wordmark--layered", sizeClass, className)}>
      <span className={ink}>{before}</span>
      <span className="wordmark-amp">{accent}</span>
      <span className={ink}>{after}</span>
    </span>
  );
}
