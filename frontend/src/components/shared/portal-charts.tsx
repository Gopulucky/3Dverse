"use client";

/**
 * Charts for the Creator Studio and Admin dashboards.
 *
 * Kept in their own module so `recharts` (the heaviest dependency in the
 * portals) is code-split: the dashboards load these through `lazy-charts.tsx`,
 * so the page can start its data requests while the chart code downloads.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, unknown>;

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  tickLine: false,
  axisLine: false,
  className: "font-data",
} as const;

export interface AreaTrendProps {
  data: Row[];
  /** Unique per chart on a page: it names the SVG gradient. */
  gradientId: string;
  /** CSS colour for the line and its fill. */
  color: string;
  strokeWidth?: number;
  fontSize?: number;
  fillOpacity?: number;
  tooltipRadius?: string;
  tickFormatter: (value: number) => string;
  tooltipFormatter: (value: number) => [string, string];
}

export function AreaTrend({
  data,
  gradientId,
  color,
  strokeWidth = 3,
  fontSize = 10,
  fillOpacity = 0.15,
  tooltipRadius = "8px",
  tickFormatter,
  tooltipFormatter,
}: AreaTrendProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="date" fontSize={fontSize} {...AXIS} />
        <YAxis fontSize={fontSize} tickFormatter={(v) => tickFormatter(Number(v))} {...AXIS} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-foreground)",
            borderRadius: tooltipRadius,
            fontSize: "12px",
            fontFamily: "var(--font-sans)",
            border: "1px solid var(--color-border)",
          }}
          formatter={(value) => tooltipFormatter(Number(value))}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={color}
          strokeWidth={strokeWidth}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({ data, color }: { data: Row[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="date" fontSize={12} {...AXIS} />
        <YAxis fontSize={12} {...AXIS} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-foreground)",
            borderRadius: "12px",
            fontFamily: "var(--font-sans)",
          }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="orders" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
