"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wand2, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const BRIEF_FEE = 25;

function NewCommissionForm() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const params = useSearchParams();
  const creatorId = params.get("creatorId");
  const creatorName = params.get("creatorName") || "this creator";

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState("");
  const [targetBudget, setTargetBudget] = useState("");
  const [material, setMaterial] = useState("");
  const [color, setColor] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [intent, setIntent] = useState<"file_only" | "print_too">("file_only");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) return null;

  if (!creatorId) {
    return (
      <MarketplaceShell>
        <div className="max-w-lg mx-auto px-6 pt-24 text-center">
          <p className="text-muted-foreground mb-4">No creator selected.</p>
          <Button asChild>
            <a href="/commissions/browse">Browse creators</a>
          </Button>
        </div>
      </MarketplaceShell>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !brief.trim()) {
      toast.error("A title and a brief are required.");
      return;
    }
    setSubmitting(true);
    try {
      const request = await api.post<{ id: number }>("/api/custom-designs/requests", {
        creator_id: Number(creatorId),
        title: title.trim(),
        brief: brief.trim(),
        category: category || undefined,
        target_budget: targetBudget ? Number(targetBudget) : undefined,
        desired_material: material || undefined,
        desired_color: color || undefined,
        dimensions_note: dimensions || undefined,
        intent,
      });

      if (referenceFile) {
        const formData = new FormData();
        formData.append("file", referenceFile);
        await api.upload(`/api/custom-designs/requests/${request.id}/reference`, formData);
      }

      // Mock brief-fee payment — same stand-in as the print-partner ticket flow.
      await api.post(`/api/custom-designs/requests/${request.id}/pay`);

      toast.success("Request sent!");
      router.push(`/commissions/${request.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketplaceShell>
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-20">
        <h1 className="text-3xl font-bold flex items-center gap-3 font-display mb-1">
          <Wand2 className="text-primary" />
          Commission {creatorName}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Describe what you want. Once you pay the brief fee, {creatorName} can review it and send
          you a quote.
        </p>

        <Card className="p-6 space-y-5">
          <div>
            <Label className="mb-1.5 block">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Articulated dragon figurine"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Brief</Label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Describe what you want made — style, size, use case, anything the creator should know."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Category (optional)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Tabletop, Jewelry…" />
            </div>
            <div>
              <Label className="mb-1.5 block">Target budget, $ (optional)</Label>
              <Input
                type="number"
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
                placeholder="150"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Material (optional)</Label>
              <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="PLA, Resin…" />
            </div>
            <div>
              <Label className="mb-1.5 block">Color (optional)</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Matte black" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Dimensions / scale (optional)</Label>
            <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="~15cm tall" />
          </div>

          <div>
            <Label className="mb-1.5 block">Reference image (optional)</Label>
            <label className="flex items-center gap-2 border border-dashed border-border rounded-md px-3 py-2.5 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
              <ImagePlus size={16} />
              {referenceFile ? referenceFile.name : "Upload a sketch or inspiration image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <Label className="mb-2 block">What do you want out of this?</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 border border-border rounded-md p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  className="mt-1"
                  checked={intent === "file_only"}
                  onChange={() => setIntent("file_only")}
                />
                <div>
                  <p className="text-sm font-semibold">Just the design file</p>
                  <p className="text-xs text-muted-foreground">
                    Get the finished 3D model to keep, print elsewhere, or share.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2.5 border border-border rounded-md p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  className="mt-1"
                  checked={intent === "print_too"}
                  onChange={() => setIntent("print_too")}
                />
                <div>
                  <p className="text-sm font-semibold">The design, printed and shipped</p>
                  <p className="text-xs text-muted-foreground">
                    The creator will also quote a per-unit print price, so you can order a
                    physical copy once the design is done.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="text-sm font-semibold">Brief fee</p>
              <p className="text-xs text-muted-foreground">Paid now, mock checkout</p>
            </div>
            <p className="text-xl font-bold font-data">${BRIEF_FEE.toFixed(2)}</p>
          </div>

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
            {submitting ? "Sending…" : `Pay $${BRIEF_FEE.toFixed(2)} & Send Request`}
          </Button>
        </Card>
      </div>
    </MarketplaceShell>
  );
}

export default function NewCommissionPage() {
  return (
    <Suspense fallback={null}>
      <NewCommissionForm />
    </Suspense>
  );
}
