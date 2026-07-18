"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Settings, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { ConsoleShell } from "@/components/layout/console-shell";
import { StatusChip } from "@/components/ui/status-chip";

const STATUS_FLOW = ["queued", "printing", "qc", "packed", "shipped", "delivered"];

export default function PartnerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["partner-jobs"],
    queryFn: () => api.get<any[]>("/api/partner/jobs"),
    enabled: isAuthenticated,
  });


  if (!isAuthenticated) return null;

  const updateStatus = async (orderId: number, status: string) => {
    try {
      await api.put(`/api/partner/jobs/${orderId}/status`, { status });
      toast.success(`Status updated to ${status.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["partner-jobs"] });
    } catch {
      toast.error("Failed to update status");
    }
  };

  const getStatusType = (status: string) => {
    if (status === "delivered") return "success";
    if (status === "queued" || status === "warning") return "warning";
    if (status === "printing" || status === "qc") return "in-progress";
    return "neutral";
  };

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <Settings className="text-primary" />
        Print Partner Dashboard
      </h1>

      {jobs.length === 0 ? (
        <Card className="p-12 text-center border-border">
          <p className="text-muted-foreground">
            You currently have no print jobs assigned.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {jobs.map((job: any) => {
            const currentStepIndex = STATUS_FLOW.indexOf(job.status);

            return (
              <Card key={job.id} className="overflow-hidden border-border bg-card">
                {/* Header */}
                <div className="bg-muted/30 p-4 border-b border-border flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      Job ID
                    </p>
                    <p className="text-sm font-data font-semibold">#{job.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      Date Assigned
                    </p>
                    <p className="text-sm font-data">{formatDate(job.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                      Status
                    </p>
                    <StatusChip
                      status={getStatusType(job.status)}
                      label={job.status?.toUpperCase()}
                    />
                  </div>
                </div>

                <div className="p-6">
                  {/* Status Pipeline */}
                  <div className="mb-8">
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {STATUS_FLOW.map((status, idx) => {
                        const isPast = idx < currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                          <div key={status} className="flex items-center">
                            <div
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                                isPast
                                  ? "bg-success/15 text-success"
                                  : isCurrent
                                  ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {isPast && <CheckCircle2 size={12} />}
                              {status.toUpperCase()}
                            </div>
                            {idx < STATUS_FLOW.length - 1 && (
                              <div
                                className={cn(
                                  "w-6 h-px mx-1",
                                  isPast ? "bg-success" : "bg-border"
                                )}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Job Details */}
                    <div>
                      <h3 className="font-bold mb-4 text-muted-foreground font-display">
                        Items to Print
                      </h3>
                      <div className="space-y-3">
                        {job.items?.map((item: any) => (
                          <Card key={item.id} className="p-3 flex gap-4 border-border/60">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {item.product?.title ||
                                  `Product #${item.product_id}`}
                              </p>
                              {item.selected_config && Object.keys(item.selected_config).length > 0 && (
                                <p className="text-xs text-muted-foreground font-data mt-1">
                                  {JSON.stringify(item.selected_config)}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground font-data">
                                Qty: {item.quantity}
                              </p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div>
                      <h3 className="font-bold mb-4 text-muted-foreground font-display">
                        Update Status
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_FLOW.map((status, idx) => {
                          const isPast = idx < currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          const isNext = idx === currentStepIndex + 1;

                          return (
                            <Button
                              key={status}
                              disabled={!isNext}
                              onClick={() => updateStatus(job.id, status)}
                              variant={
                                isPast
                                  ? "secondary"
                                  : isCurrent
                                  ? "console"
                                  : isNext
                                  ? "outline"
                                  : "ghost"
                              }
                              size="sm"
                              className={cn(
                                isPast && "opacity-50",
                                isCurrent && "ring-2 ring-primary/30"
                              )}
                            >
                              {status.toUpperCase()}
                            </Button>
                          );
                        })}
                      </div>

                      {job.tracking_url && (
                        <Card className="mt-6 p-4 border-border">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold font-display">
                            Shiprocket Info
                          </p>
                          <a
                            href={job.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center text-sm gap-2 font-semibold"
                          >
                            <Truck size={14} />
                            Track Shipment
                          </a>
                          <p className="text-xs text-muted-foreground mt-2 font-data">
                            AWB / Order: {job.shiprocket_order_id}
                          </p>
                        </Card>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <ConsoleShell>
      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-10 w-64" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </ConsoleShell>
  );
}
