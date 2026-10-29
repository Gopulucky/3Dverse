"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { canDownloadModel, type DownloadOrder, type DownloadItem } from "@/lib/order-download";
import { Button } from "@/components/ui/button";

export function DownloadModel({ order, item }: { order: DownloadOrder; item: DownloadItem }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!canDownloadModel(order, item)) return null;
  return <div className="mt-3">
    <Button type="button" variant="outline" disabled={busy} aria-busy={busy} className="min-h-11" onClick={async () => {
      setBusy(true);
      setMessage("");
      try {
        await api.download(`/api/downloads/products/${item.product_id}/model`);
        setMessage("Your file download has started.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not download your file. Please try again.");
      } finally { setBusy(false); }
    }}>{busy ? "Preparing your file…" : "Download 3D file"}</Button>
    <p role="status" className="text-sm text-muted-foreground mt-2">{message}</p>
  </div>;
}
