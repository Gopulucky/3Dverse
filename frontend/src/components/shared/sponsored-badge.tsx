"use client";

/**
 * SponsoredBadge — mandatory wrapper for ANY paid placement (platform or creator).
 * The "Sponsored" label is always rendered and never a togglable field.
 */
export function SponsoredBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group">
      <span className="absolute top-2 right-2 z-10 text-[10px] font-semibold bg-ink/90 text-primary-foreground px-2 py-0.5 rounded-full tracking-wide uppercase backdrop-blur-sm">
        Sponsored
      </span>
      {children}
    </div>
  );
}
