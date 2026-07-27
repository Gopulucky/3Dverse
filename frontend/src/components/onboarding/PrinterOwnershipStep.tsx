"use client";
import { useState } from "react";

const TECHNOLOGIES = [
  { value: "fdm", label: "Material Extrusion (FDM/FFF)" },
  { value: "sla", label: "Vat Photopolymerization (SLA/DLP/MSLA)" },
  { value: "sls", label: "Powder Bed Fusion — SLS" },
  { value: "slm", label: "Powder Bed Fusion — SLM" },
  { value: "dmls", label: "Powder Bed Fusion — DMLS" },
  { value: "ebm", label: "Powder Bed Fusion — EBM" },
  { value: "mjf", label: "Powder Bed Fusion — MJF" },
  { value: "material_jetting", label: "Material Jetting (PolyJet)" },
  { value: "binder_jetting", label: "Binder Jetting" },
  { value: "ded", label: "Directed Energy Deposition (DED)" },
  { value: "sheet_lamination", label: "Sheet Lamination" },
];

export default function PrinterOwnershipStep({ onComplete }: { onComplete: () => void }) {
  const [ownsPrinter, setOwnsPrinter] = useState<boolean | null>(null);
  const [technology, setTechnology] = useState("fdm");

  const submit = async () => {
    // Note: ensure the token is attached in your real app (e.g. through a wrapper or fetch interceptor)
    await fetch(process.env.NEXT_PUBLIC_API_URL + "/creator/onboarding/printer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owns_printer: ownsPrinter, technology: ownsPrinter ? technology : null }),
    });
    onComplete();
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold">Do you own a 3D printer?</h2>
      <div className="flex gap-3">
        <button onClick={() => setOwnsPrinter(true)}
          className={`px-4 py-2 rounded border transition-colors ${ownsPrinter === true ? "bg-primary text-primary-foreground" : ""}`}>
          Yes, I have one
        </button>
        <button onClick={() => setOwnsPrinter(false)}
          className={`px-4 py-2 rounded border transition-colors ${ownsPrinter === false ? "bg-primary text-primary-foreground" : ""}`}>
          No, design only
        </button>
      </div>

      {ownsPrinter && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="block text-sm font-medium mb-1">Which technology?</label>
          <select value={technology} onChange={e => setTechnology(e.target.value)}
            className="w-full border rounded p-2 focus:ring focus:ring-blue-200 transition-shadow">
            {TECHNOLOGIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {ownsPrinter !== null && (
        <button onClick={submit} className="w-full bg-success hover:bg-green-700 text-primary-foreground rounded py-2 transition-colors animate-in fade-in duration-300">
          Continue
        </button>
      )}
    </div>
  );
}
