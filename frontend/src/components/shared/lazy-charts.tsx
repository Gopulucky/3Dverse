"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Chart code loads after the page paints; the skeleton holds the chart's space,
// so nothing shifts when it arrives.
const placeholder = () => <Skeleton className="h-full w-full" />;

// Start the download now, alongside the page's data request, rather than when
// the data lands and the chart first renders (that would add a second wait).
if (typeof window !== "undefined") void import("./portal-charts");

export const AreaTrend = dynamic(
  () => import("./portal-charts").then((m) => m.AreaTrend),
  { ssr: false, loading: placeholder }
);

export const BarTrend = dynamic(
  () => import("./portal-charts").then((m) => m.BarTrend),
  { ssr: false, loading: placeholder }
);
