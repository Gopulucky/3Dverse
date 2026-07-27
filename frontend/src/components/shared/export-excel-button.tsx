"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportExcelButton() {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/export/excel`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "3dverse-metrics.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={downloading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {downloading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      {downloading ? "Exporting…" : "Download Excel"}
    </button>
  );
}
