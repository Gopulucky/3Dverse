"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterValues {
  category: string;
  format: string;
  currency: string;
  min: string;
  max: string;
}

type Patch = Partial<FilterValues>;

function Section({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border py-3">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="flex min-h-9 w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} hidden={!open} className="mt-2 space-y-1">{children}</div>
    </section>
  );
}

function Choice({ type, name, label, checked, onChange }: { type: "checkbox" | "radio"; name?: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
      <input type={type} name={name} checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-[var(--store-action)]" />
      <span>{label}</span>
    </label>
  );
}

/**
 * Left-hand filter panel, in the style of large shops: a header with Clear all,
 * collapsible sections, and choices that apply at once. Price applies with its own button.
 */
export function CatalogueFilters({ values, categories, anyApplied, onChange, onClear, onClose }: {
  values: FilterValues;
  categories: string[];
  anyApplied: boolean;
  onChange: (patch: Patch) => void;
  onClear: () => void;
  /** Phone sheet only: closes the sheet. */
  onClose?: () => void;
}) {
  const submitPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onChange({ min: String(data.get("min") ?? "").trim(), max: String(data.get("max") ?? "").trim() });
  };
  return (
    <form aria-label="Catalogue filters" onSubmit={submitPrice} className="pb-16 md:pb-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Filters</h2>
        <div className="flex items-center gap-1">
          {anyApplied && <button type="button" onClick={onClear} className="min-h-9 px-2 text-xs font-semibold uppercase tracking-wide text-primary-ink hover:underline">Clear all</button>}
          {onClose && <Button type="button" variant="ghost" size="icon" aria-label="Close filters" className="md:hidden" onClick={onClose}><X size={20} aria-hidden="true" /></Button>}
        </div>
      </div>

      <Section title="Category" defaultOpen>
        {categories.map(name => <Choice key={name} type="checkbox" label={name} checked={values.category === name} onChange={() => onChange({ category: values.category === name ? "" : name })} />)}
      </Section>

      <Section title="Format" defaultOpen>
        <Choice type="checkbox" label="Printed products" checked={values.format === "physical"} onChange={() => onChange({ format: values.format === "physical" ? "" : "physical" })} />
        <Choice type="checkbox" label="Digital models" checked={values.format === "digital"} onChange={() => onChange({ format: values.format === "digital" ? "" : "digital" })} />
      </Section>

      <Section title="Price" defaultOpen>
        <div className="flex items-center gap-2">
          <input name="min" type="number" min="0" step="0.01" inputMode="decimal" aria-label="Minimum price" placeholder="Min" defaultValue={values.min} key={`min-${values.min}`} className="min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" />
          <span className="text-sm text-muted-foreground">to</span>
          <input name="max" type="number" min="0" step="0.01" inputMode="decimal" aria-label="Maximum price" placeholder="Max" defaultValue={values.max} key={`max-${values.max}`} className="min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">Apply price</Button>
        <p className="pt-1 text-xs text-muted-foreground">Prices are in INR unless you choose USD below.</p>
      </Section>

      <Section title="Currency" defaultOpen={Boolean(values.currency)}>
        <Choice type="radio" name="currency" label="All currencies" checked={!values.currency} onChange={() => onChange({ currency: "" })} />
        <Choice type="radio" name="currency" label="INR" checked={values.currency === "INR"} onChange={() => onChange({ currency: "INR" })} />
        <Choice type="radio" name="currency" label="USD" checked={values.currency === "USD"} onChange={() => onChange({ currency: "USD" })} />
      </Section>

      {onClose && <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background p-3 md:hidden">
        <Button type="button" className="w-full min-h-11" onClick={onClose}>Show results</Button>
      </div>}
    </form>
  );
}
