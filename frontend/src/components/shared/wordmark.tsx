import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { LOGO } from "@/lib/logo-paths";

/**
 * The buy&sell3d logo, drawn from the owner's artwork: the name alone, no symbol.
 * Single source so the navbar, footer and sign-in never drift. "buy" and "sell"
 * take the text colour; "&" and "3d" are amber. The name is also real text for
 * screen readers and search.
 *
 * `variant="short"` is the "&3d" mark, for places too small for the name.
 * `tone="inverse"` is for dark panels: the whole mark in one light colour.
 * Height follows the font size.
 */
export function Wordmark({
  className,
  size = "md",
  tone = "default",
  variant = "name",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "inverse";
  variant?: keyof typeof LOGO;
}) {
  const sizeClass = {
    sm: "text-xl",
    md: "text-xl min-[26rem]:text-[1.625rem]",
    lg: "text-4xl sm:text-5xl",
  }[size];
  const mark = LOGO[variant];

  return (
    <span className={cn("wordmark inline-block normal-case whitespace-nowrap leading-none", sizeClass, tone === "inverse" ? "text-background wordmark--mono" : "text-foreground", className)}>
      <span className="sr-only">{BRAND.name}</span>
      <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${mark.width} ${mark.height}`} className="wordmark-art">
        <path d={mark.ink} fill="currentColor" fillRule="evenodd" />
        <path d={mark.accent} className="wordmark-accent" fillRule="evenodd" />
      </svg>
    </span>
  );
}
