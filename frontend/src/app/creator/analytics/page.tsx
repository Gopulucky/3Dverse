"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Percent,
  IndianRupee,
  ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { StatCard } from "@/components/shared/stat-card";
import { FilamentSpoolTable } from "@/components/shared/filament-spool-table";
import { RewardCenter } from "@/components/shared/reward-center";
import { ExportExcelButton } from "@/components/shared/export-excel-button";

interface RevenueSummary {
  total_sales: number;
  total_earnings: number;
  orders_count: number;
  average_order_value: number;
  platform_fees_paid: number;
}

export default function CreatorAnalyticsPage() {
  const { ready: isAuthenticated } = useRequireAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["creator-financial-summary"],
    queryFn: () =>
      api.get<RevenueSummary>("/api/creator/financial/metrics/summary"),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const content = (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <BarChart3 className="text-primary" />
            Financial Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Revenue metrics, filament inventory, and reward points — all in one
            place.
          </p>
        </div>
        <ExportExcelButton />
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Sales"
          value={`₹${data?.total_sales?.toFixed(2) || "0.00"}`}
          icon={IndianRupee}
          iconBg="bg-primary/15"
          iconColor="text-primary"
        />
        <StatCard
          label="Total Earnings"
          value={`₹${data?.total_earnings?.toFixed(2) || "0.00"}`}
          icon={TrendingUp}
          iconBg="bg-success/15"
          iconColor="text-success"
        />
        <StatCard
          label="Orders"
          value={`${data?.orders_count || 0}`}
          icon={ShoppingBag}
          iconBg="bg-primary/15"
          iconColor="text-primary"
        />
        <StatCard
          label="Avg Order Value"
          value={`₹${data?.average_order_value?.toFixed(2) || "0.00"}`}
          icon={BarChart3}
          iconBg="bg-moss/15"
          iconColor="text-moss"
        />
        <StatCard
          label="Platform Fees"
          value={`₹${data?.platform_fees_paid?.toFixed(2) || "0.00"}`}
          icon={Receipt}
          iconBg="bg-ember/15"
          iconColor="text-ember"
        />
      </div>

      {/* Filament + Rewards — two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        <FilamentSpoolTable />
        <RewardCenter />
      </div>
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
