"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Truck, CheckCircle2, Package, Printer, AlertTriangle, PlayCircle, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { ConsoleShell } from "@/components/layout/console-shell";
import { StatusChip } from "@/components/ui/status-chip";
import { StatCard } from "@/components/shared/stat-card";
import { PrinterCard, PrinterData } from "@/components/shared/printer-card";

const STATUS_FLOW = ["queued", "printing", "qc", "packed", "shipped", "delivered"];

interface Ticket {
  id: number;
  creator_id: number;
  product_reference: string | null;
  ticket_fee: number;
  payment_status: string;
  workflow_status: string;
  overflow_reason: string | null;
  decline_reason: string | null;
  created_at: string;
}

const TICKET_STATUS_TYPE: Record<string, "success" | "warning" | "in-progress" | "neutral"> = {
  agreed: "success",
  rejected: "neutral",
  expired: "neutral",
  pending_payment: "warning",
  paid: "in-progress",
  design_submitted: "in-progress",
  sample_printing: "in-progress",
  certified: "in-progress",
  negotiating: "in-progress",
};

export default function PartnerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [activeTab, setActiveTab] = useState<"jobs" | "tickets" | "fleet">("jobs");

  // Fetch Jobs
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["partner-jobs"],
    queryFn: () => api.get<any[]>("/api/partner/jobs"),
    enabled: isAuthenticated,
  });

  // Fetch incoming collaboration tickets (evaluation requests from creators)
  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["partner-tickets"],
    queryFn: () => api.get<Ticket[]>("/api/collaboration/tickets"),
    enabled: isAuthenticated,
  });

  // Fetch Fleet (Printers)
  const { data: printers = [], isLoading: isLoadingPrinters } = useQuery({
    queryKey: ["partner-printers"],
    queryFn: () => api.get<any[]>("/api/partner/printers"),
    enabled: isAuthenticated,
  });

  // Fetch Analytics
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["partner-analytics"],
    queryFn: () => api.get<any>("/api/partner/analytics"),
    enabled: isAuthenticated,
  });

  const pendingTickets = tickets.filter((t) =>
    ["paid", "design_submitted", "sample_printing", "certified", "negotiating"].includes(t.workflow_status)
  );

  const handleDecline = async (ticketId: number) => {
    const reason = window.prompt("Reason for declining this ticket (shown to the creator):");
    if (!reason?.trim()) return;
    try {
      await api.post(`/api/collaboration/tickets/${ticketId}/decline`, { reason: reason.trim() });
      toast.success("Ticket declined");
      queryClient.invalidateQueries({ queryKey: ["partner-tickets"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to decline ticket");
    }
  };

  if (!isAuthenticated) return null;

  const updateStatus = async (orderId: number, status: string) => {
    try {
      await api.put(`/api/partner/jobs/${orderId}/status`, { status });
      toast.success(`Status updated to ${status.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["partner-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["partner-analytics"] });
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

  const isLoading = isLoadingJobs || isLoadingTickets || isLoadingPrinters || isLoadingAnalytics;

  const renderKPIs = () => (
    <div className="flex flex-wrap items-center gap-6 bg-card border border-border p-6 rounded-2xl mb-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Today's Jobs</p>
        <p className="text-3xl font-bold font-display text-foreground">{analytics?.active_jobs || 18}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" /> Printing
        </p>
        <p className="text-3xl font-bold font-display text-foreground">6</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" /> Ready / QC
        </p>
        <p className="text-3xl font-bold font-display text-foreground">{analytics?.pending_qc || 3}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-moss" /> Completed
        </p>
        <p className="text-3xl font-bold font-display text-foreground">9</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px] text-right">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Revenue</p>
        <p className="text-3xl font-bold font-display text-success">$482.00</p>
      </div>
    </div>
  );

  const renderJobs = () => {
    if (jobs.length === 0) {
      return (
        <Card className="p-12 text-center border-border">
          <p className="text-muted-foreground">You currently have no print jobs assigned.</p>
        </Card>
      );
    }
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {jobs.map((job: any) => {
          const currentStepIndex = STATUS_FLOW.indexOf(job.status);
          
          let borderColor = "border-l-border";
          if (job.status === "queued") borderColor = "border-l-moss";
          else if (job.status === "printing") borderColor = "border-l-warning";
          else if (job.status === "shipped" || job.status === "delivered") borderColor = "border-l-success";

          return (
            <Card key={job.id} className={`overflow-hidden border-border bg-card border-l-4 ${borderColor} hover-lift transition-all`}>
              <div className="bg-muted/30 p-4 border-b border-border flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Job ID</p>
                  <p className="text-sm font-data font-semibold">#{job.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Date Assigned</p>
                  <p className="text-sm font-data">{formatDate(job.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Status</p>
                  <StatusChip status={getStatusType(job.status)} label={job.status?.toUpperCase()} />
                </div>
              </div>
              <div className="p-6">
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
                              isPast ? "bg-success-surface text-success-ink" : isCurrent ? "bg-moss-surface text-moss-ink ring-2 ring-moss/30" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isPast && <CheckCircle2 size={12} />}
                            {status.toUpperCase()}
                          </div>
                          {idx < STATUS_FLOW.length - 1 && <div className={cn("w-6 h-px mx-1", isPast ? "bg-success" : "bg-border")} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {currentStepIndex === 0 ? (
                  <div className="bg-moss/5 border border-moss/20 rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500 mt-4">
                    <h3 className="font-bold font-display text-2xl mb-2 text-foreground">New Job Request</h3>
                    <p className="text-sm text-muted-foreground mb-8">Review the requirements and accept the job to begin printing.</p>
                    
                    <div className="flex flex-wrap justify-center gap-12 mb-8">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Est. Time</p>
                        <p className="font-data font-bold text-xl">4h 30m</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Material Cost</p>
                        <p className="font-data font-bold text-xl">$12.40</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Profit</p>
                        <p className="font-data font-bold text-xl text-success">$35.60</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Delivery By</p>
                        <p className="font-data font-bold text-xl">Oct 24</p>
                      </div>
                    </div>
                    
                    <Button onClick={() => updateStatus(job.id, "printing")} size="lg" className="rounded-xl px-12 shadow-lg hover-lift font-bold text-base">
                      Accept Job & Start Printing
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-bold mb-4 text-muted-foreground font-display">Items to Print</h3>
                      <div className="space-y-3">
                        {job.items?.map((item: any) => (
                          <Card key={item.id} className="p-3 flex gap-4 border-border/60">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{item.product?.title || `Product #${item.product_id}`}</p>
                              {item.selected_config && Object.keys(item.selected_config).length > 0 && (
                                <p className="text-xs text-muted-foreground font-data mt-1">{JSON.stringify(item.selected_config)}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground font-data">Qty: {item.quantity}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold mb-4 text-muted-foreground font-display">Update Status</h3>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {STATUS_FLOW.map((status, idx) => {
                          const isPast = idx < currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          const isNext = idx === currentStepIndex + 1;
                          return (
                            <Button
                              key={status}
                              disabled={!isNext}
                              onClick={() => updateStatus(job.id, status)}
                              variant={isPast ? "secondary" : isCurrent ? "glow" : isNext ? "outline" : "ghost"}
                              size="sm"
                              className={cn(isPast && "opacity-50", isCurrent && "ring-2 ring-moss/30", isNext && "border-moss text-moss hover:bg-moss hover:text-moss-ink")}
                            >
                              {status.toUpperCase()}
                            </Button>
                          );
                        })}
                      </div>
                      
                      {currentStepIndex === 1 && (
                        <Card className="p-4 border-warning/30 bg-warning/5">
                          <p className="text-xs text-warning uppercase tracking-wider mb-2 font-bold font-display">Quality Checklist</p>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                              <input type="checkbox" className="rounded border-muted text-warning focus:ring-warning" /> No layer shifts or stringing
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                              <input type="checkbox" className="rounded border-muted text-warning focus:ring-warning" /> Supports removed cleanly
                            </label>
                          </div>
                        </Card>
                      )}

                      {job.tracking_url && (
                        <Card className="mt-6 p-4 border-border">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold font-display">Shiprocket Info</p>
                          <a href={job.tracking_url} target="_blank" rel="noopener noreferrer" className="text-moss hover:underline flex items-center text-sm gap-2 font-semibold">
                            <Truck size={14} /> Track Shipment
                          </a>
                          <p className="text-xs text-muted-foreground mt-2 font-data">AWB / Order: {job.shiprocket_order_id}</p>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderTickets = () => {
    if (pendingTickets.length === 0) {
      return (
        <Card className="p-12 text-center border-border">
          <p className="text-muted-foreground">No open evaluation tickets right now.</p>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {pendingTickets.map((t) => (
          <Card key={t.id} className="p-5 border-border bg-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm">Ticket #{t.id}</p>
                <StatusChip status={TICKET_STATUS_TYPE[t.workflow_status] || "neutral"} label={t.workflow_status.replace(/_/g, " ").toUpperCase()} />
              </div>
              <p className="text-sm text-muted-foreground">{t.product_reference || "Evaluation ticket"}</p>
              {t.overflow_reason && (
                <p className="text-xs text-muted-foreground mt-1">
                  Overflow reason: <span className="capitalize">{t.overflow_reason.replace(/_/g, " ")}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground font-data mt-1">{formatDate(t.created_at)} · Fee ${t.ticket_fee}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => router.push(`/collaboration/${t.id}`)}>
                Open
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDecline(t.id)}>
                <X size={14} /> Decline
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderFleet = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {printers?.map((p: any, idx: number) => {
        // Mock utilization data for demo purposes since it might not be in DB
        const mockUtilization = p.status === "active" ? 75 + (idx * 5) : 0;
        
        const printerData: PrinterData = {
          id: p.id,
          name: p.name,
          status: p.status === "active" ? "running" : p.status === "maintenance" ? "maintenance" : "idle",
          utilization: mockUtilization,
          technology: p.technology
        };
        
        return <PrinterCard key={p.id} printer={printerData} />;
      })}
      {printers?.length === 0 && (
        <Card className="col-span-full p-12 text-center border-border">
          <p className="text-muted-foreground">No printers assigned.</p>
        </Card>
      )}
    </div>
  );

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <Settings className="text-moss" />
        Print Partner Dashboard
      </h1>

      {renderKPIs()}

      <div className="mb-6 border-b border-border flex gap-4">
        <button
          onClick={() => setActiveTab("jobs")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "jobs" ? "text-moss" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Package size={16} /> Job Queue
          </div>
          {activeTab === "jobs" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab("tickets")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "tickets" ? "text-moss" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Inbox size={16} /> Ticket Inbox
            {pendingTickets.length > 0 && (
              <span className="bg-moss-surface text-moss-ink text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {pendingTickets.length}
              </span>
            )}
          </div>
          {activeTab === "tickets" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab("fleet")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "fleet" ? "text-moss" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Printer size={16} /> Fleet Management
          </div>
          {activeTab === "fleet" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss rounded-t" />}
        </button>
      </div>

      {activeTab === "jobs" ? renderJobs() : activeTab === "tickets" ? renderTickets() : renderFleet()}
    </div>
  );

  return (
    <ConsoleShell>
      {isLoading ? (
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        content
      )}
    </ConsoleShell>
  );
}
