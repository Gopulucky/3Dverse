"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Chip {
  label: string;
  href: string;
  /** Marks the choice the page is showing now. */
  current?: boolean;
}

/**
 * One row of choices that scrolls sideways when it does not fit. Categories on the
 * home page and the catalogue use it, so they look and behave the same.
 */
export function ChipRow({ label, items, className, variant = "chips", keepScroll = false }: {
  label: string;
  items: Chip[];
  className?: string;
  /** "tabs" is the quieter, underlined form for a second level of choice. */
  variant?: "chips" | "tabs";
  /** True when a choice filters this page, so the reader stays where they are. */
  keepScroll?: boolean;
}) {
  const list = useRef<HTMLUListElement>(null);
  const currentLabel = items.find((item) => item.current)?.label;

  // On a narrow screen the chosen chip may start out of sight; bring it into the row.
  useEffect(() => {
    const row = list.current;
    const chosen = row?.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement;
    if (row && chosen) row.scrollLeft = chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2;
  }, [currentLabel, items.length]);

  return (
    <nav aria-label={label} className={cn("chip-row", `chip-row--${variant}`, className)}>
      <ul ref={list} className="category-list">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} scroll={!keepScroll} aria-current={item.current ? "page" : undefined} className="category-chip">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
