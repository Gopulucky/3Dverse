"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

/** One image's caption in the creator's Media Hub. Saves when the field is left, only if it changed. */
export function MediaCaptionField({
  productId,
  mediaId,
  caption,
  onSaved,
}: {
  productId: number | string;
  mediaId: number;
  caption?: string | null;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(caption ?? "");
  const [saved, setSaved] = useState(caption ?? "");

  const save = async () => {
    const next = value.trim();
    if (next === saved) return;
    try {
      await api.put(`/api/products/${productId}/media/${mediaId}`, { caption: next });
      setSaved(next);
      setValue(next);
      onSaved?.();
    } catch {
      toast.error("Couldn't save that caption. Please try again.");
    }
  };

  return (
    <Input
      value={value}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
      placeholder="What does this picture show?"
      aria-label="Image caption"
      className="h-9 text-sm"
    />
  );
}
