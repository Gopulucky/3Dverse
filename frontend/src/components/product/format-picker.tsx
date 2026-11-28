"use client";

import { Download, Printer } from "lucide-react";
import { purchasePrice, type PurchaseType, type ProductCardData } from "@/lib/marketplace";
import { displayPrice } from "@/lib/region";
import { cn } from "@/lib/utils";

const COPY: Record<PurchaseType, { name: string; hint: string }> = {
  digital: { name: "Digital model file", hint: "Download it and print it yourself." },
  physical: { name: "Finished print", hint: "Printed and delivered to you. Shipping at checkout." },
};

/**
 * The compact "what are you buying" choice: one two-line row per offered format,
 * with its own price, so the shopper sees both prices before choosing.
 */
export function FormatPicker({
  product,
  formats,
  value,
  onChange,
  country,
}: {
  product: ProductCardData;
  formats: PurchaseType[];
  value: PurchaseType | "";
  onChange: (format: PurchaseType) => void;
  country: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">What are you buying?</legend>
      {formats.map((format) => {
        const price = purchasePrice(product, format);
        const Icon = format === "digital" ? Download : Printer;
        const checked = value === format;
        return (
          <label
            key={format}
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--store-focus,currentColor)]",
              checked ? "border-primary bg-primary-surface" : "border-input bg-card hover:border-primary/50"
            )}
          >
            <input
              type="radio"
              name="purchase-format"
              value={format}
              checked={checked}
              onChange={() => onChange(format)}
              className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon size={14} aria-hidden="true" />
                  {COPY[format].name}
                </span>
                <span className="font-data text-sm font-semibold whitespace-nowrap">
                  {price == null ? "Not priced yet" : displayPrice(price, product.currency, country).main}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{COPY[format].hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
