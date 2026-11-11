"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PartnerProfile {
  name: string;
  region: string | null;
  bio: string | null;
  accepting_work: boolean;
  lead_time_days: number | null;
  price_per_gram_inr: number | null;
  min_order_inr: number | null;
  build_x_mm: number | null;
  build_y_mm: number | null;
  build_z_mm: number | null;
  capabilities: { technology: string; material: string }[];
  missing: string[];
}

export interface ProfileSave {
  profile: Record<string, number | string | null>;
  capabilities: { technology: string; material: string }[];
}

const TECHNOLOGIES = ["fdm", "sla", "sls", "slm", "dmls", "ebm", "mjf", "material_jetting", "binder_jetting", "ded", "sheet_lamination"];
const MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Resin", "Carbon fibre", "Aluminium", "Stainless steel"];
const techLabel = (value: string) => value.replace(/_/g, " ").toUpperCase();

function NumberField({ id, label, value, onChange, step = "1", hint }: { id: string; label: string; value: string; onChange: (v: string) => void; step?: string; hint?: string }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block">{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min="0" step={step} value={value} onChange={event => onChange(event.target.value)} className="min-h-11" />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProfileTab({ profile, saving, error, onSave }: {
  profile: PartnerProfile;
  saving: boolean;
  error: string;
  onSave: (save: ProfileSave) => void;
}) {
  const text = (value: number | null) => (value == null ? "" : String(value));
  const [lead, setLead] = useState(text(profile.lead_time_days));
  const [price, setPrice] = useState(text(profile.price_per_gram_inr));
  const [minOrder, setMinOrder] = useState(text(profile.min_order_inr));
  const [x, setX] = useState(text(profile.build_x_mm));
  const [y, setY] = useState(text(profile.build_y_mm));
  const [z, setZ] = useState(text(profile.build_z_mm));
  const [bio, setBio] = useState(profile.bio ?? "");
  const [caps, setCaps] = useState(profile.capabilities);
  const [technology, setTechnology] = useState("fdm");
  const [material, setMaterial] = useState("");

  const addCapability = () => {
    const name = material.trim();
    if (!name) return;
    if (!caps.some(c => c.technology === technology && c.material.toLowerCase() === name.toLowerCase())) {
      setCaps([...caps, { technology, material: name }]);
    }
    setMaterial("");
  };

  const submit = () => {
    const values: Record<string, number | string | null> = {};
    const numbers: [string, string][] = [["lead_time_days", lead], ["price_per_gram_inr", price], ["min_order_inr", minOrder], ["build_x_mm", x], ["build_y_mm", y], ["build_z_mm", z]];
    for (const [key, raw] of numbers) {
      if (raw.trim() !== "") values[key] = Number(raw);
      // Only the minimum order is optional: clearing it removes it. The other fields are required,
      // so a blank one is left unchanged and the form shows the saved value again after saving.
      else if (key === "min_order_inr" && profile.min_order_inr != null) values[key] = null;
    }
    values.bio = bio.trim();
    onSave({ profile: values, capabilities: caps });
  };

  return (
    <form data-flow="partner-profile" className="space-y-6" onSubmit={event => { event.preventDefault(); submit(); }}>
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">What you can print</h2>
        <div className="flex flex-wrap gap-2" aria-label="Your capabilities">
          {caps.length === 0 && <p className="text-sm text-muted-foreground">No capabilities yet. Add the technology and material you work with.</p>}
          {caps.map(cap => (
            <span key={`${cap.technology}-${cap.material}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-3 pr-1 text-sm font-medium">
              {techLabel(cap.technology)} · {cap.material}
              <button type="button" aria-label={`Remove ${techLabel(cap.technology)} ${cap.material}`} onClick={() => setCaps(caps.filter(c => c !== cap))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"><X size={14} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="cap-technology" className="mb-2 block">Technology</Label>
            <select id="cap-technology" value={technology} onChange={event => setTechnology(event.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
              {TECHNOLOGIES.map(value => <option key={value} value={value}>{techLabel(value)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cap-material" className="mb-2 block">Material</Label>
            <Input id="cap-material" list="cap-materials" value={material} onChange={event => setMaterial(event.target.value)} placeholder="For example PLA" className="min-h-11"
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCapability(); } }} />
            <datalist id="cap-materials">{MATERIALS.map(m => <option key={m} value={m} />)}</datalist>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={addCapability}><Plus size={16} aria-hidden="true" /> Add capability</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Largest print</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="build-x" label="Build X (mm)" value={x} onChange={setX} />
          <NumberField id="build-y" label="Build Y (mm)" value={y} onChange={setY} />
          <NumberField id="build-z" label="Build Z (mm)" value={z} onChange={setZ} />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Rates and timing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="price-gram" label="Price per gram (INR)" value={price} onChange={setPrice} step="0.01" />
          <NumberField id="min-order" label="Minimum order (INR)" value={minOrder} onChange={setMinOrder} step="1" />
          <NumberField id="lead-time" label="Lead time (days)" value={lead} onChange={setLead} hint="Days from accepting a job to dispatch." />
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <Label htmlFor="shop-bio" className="block font-display text-lg font-semibold">About your shop</Label>
        <textarea id="shop-bio" value={bio} onChange={event => setBio(event.target.value)} maxLength={600} rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="What you specialise in, and what creators can expect." />
        <p className="text-xs text-muted-foreground">{bio.length}/600</p>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="min-h-11 w-full sm:w-auto" disabled={saving}>
        {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
