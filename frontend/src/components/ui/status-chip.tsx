"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, AlertCircle, Clock, Loader2, XCircle } from "lucide-react";

const statusChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      status: {
        neutral: "bg-secondary text-secondary-foreground",
        success: "bg-calibration-cyan/15 text-calibration-cyan",
        warning: "bg-nozzle-orange/15 text-nozzle-orange",
        danger: "bg-danger-red/15 text-danger-red",
        "in-progress": "bg-primary/15 text-primary",
        pending: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  }
);

const statusIcons = {
  neutral: null,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: XCircle,
  "in-progress": Loader2,
  pending: Clock,
};

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusChipVariants> {
  label: string;
  showIcon?: boolean;
}

export function StatusChip({
  className,
  status = "neutral",
  label,
  showIcon = true,
  ...props
}: StatusChipProps) {
  const Icon = status ? statusIcons[status] : null;
  const isInProgress = status === "in-progress";

  return (
    <div
      className={cn(statusChipVariants({ status }), className)}
      {...props}
    >
      {showIcon && Icon && (
        <Icon
          size={12}
          className={cn(isInProgress && "animate-spin")}
        />
      )}
      <span>{label}</span>
    </div>
  );
}
