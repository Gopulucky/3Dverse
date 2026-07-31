"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  installBugDetector,
  auditCurrentPage,
  getBugs,
  clearBugs,
  subscribeToBugs,
  isDetectorEnabled,
  type BugRecord,
} from "@/lib/bug-detector";

const SEVERITY_COLOR: Record<BugRecord["severity"], string> = {
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

/**
 * Floating dev-only widget that surfaces whatever bug-detector has caught on
 * the current page — thrown errors, failed requests, dead buttons. Mount once
 * in <Providers>; it no-ops in production unless NEXT_PUBLIC_BUG_DETECTOR=1.
 */
export function BugOverlay() {
  const pathname = usePathname();
  const [bugs, setBugs] = useState<BugRecord[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    installBugDetector();
    setBugs(getBugs());
    return subscribeToBugs(setBugs);
  }, []);

  // Re-audit the DOM for dead buttons/links shortly after each navigation,
  // once the new route has painted.
  useEffect(() => {
    if (!isDetectorEnabled()) return;
    const t = setTimeout(() => auditCurrentPage(), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!isDetectorEnabled()) return null;

  const errorCount = bugs.filter((b) => b.severity === "error").length;
  const warningCount = bugs.filter((b) => b.severity === "warning").length;
  const total = errorCount + warningCount;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-mono text-xs">
      {open && (
        <div className="mb-2 max-h-[60vh] w-[420px] overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-2">
            <span className="font-semibold text-foreground">
              {bugs.length === 0 ? "No issues detected" : `${bugs.length} issue${bugs.length === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => clearBugs()}
                title="Clear"
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {bugs.map((bug) => (
              <li key={bug.id} className="p-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`${SEVERITY_COLOR[bug.severity]} font-semibold`}>
                    [{bug.kind}]
                  </span>
                  {bug.count > 1 && (
                    <span className="shrink-0 rounded bg-muted px-1.5 text-muted-foreground">
                      ×{bug.count}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 break-words text-foreground">{bug.message}</p>
                {bug.detail && (
                  <p className="mt-0.5 break-words text-muted-foreground">{bug.detail}</p>
                )}
                <p className="mt-0.5 text-muted-foreground/70">{bug.route}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-lg transition-colors ${
          total > 0
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        <Bug size={14} />
        {total > 0 ? `${total} issue${total === 1 ? "" : "s"}` : "OK"}
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
}
