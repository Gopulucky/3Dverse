"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Truck, CheckCircle2, Package, Printer, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { ConsoleShell } from "@/components/layout/console-shell";
import { StatusChip } from "@/components/ui/status-chip";
import { formatMoney } from "@/lib/currency";

const STATUS_FLOW = ["queued", "printing", "qc", "packed", "shipped", "delivered"];
const STATUS_LABEL: Record<string, string> = {paid: "Payment confirmed", queued: "Queued", printing: "Printing", qc: "Quality check", packed: "Packed", shipped: "Shipped", delivered: "Delivered"};
const ACTION_LABEL: Record<string, string> = {queued: "Add to print queue", printing: "Start printing", qc: "Send to quality check", packed: "Pack and create shipping label", shipped: "Mark as shipped", delivered: "Confirm delivery"};
type Parcel = {length_cm: string; breadth_cm: string; height_cm: string; weight_kg: string};
const PARCEL_FIELDS = [{key: "length_cm", label: "Length (cm)"}, {key: "breadth_cm", label: "Breadth (cm)"}, {key: "height_cm", label: "Height (cm)"}, {key: "weight_kg", label: "Weight (kg)"}] as const;
interface Job { id: number; status: string; created_at: string; shipping_package?: Record<string, number> | null; tracking_url?: string; shiprocket_order_id?: string; items: {id: number; product_id: number; quantity: number; product?: {title: string}; selected_config?: Record<string, unknown>}[] }
interface FleetPrinter {id: number; name: string; status: string; technology: string}
interface Analytics {active_jobs: number; pending_qc: number; active_printers: number; maintenance_alerts: number}

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
  const [parcels, setParcels] = useState<Record<number, Partial<Parcel>>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Fetch Jobs
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["partner-jobs"],
    queryFn: () => api.get<Job[]>("/api/partner/jobs"),
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
    queryFn: () => api.get<FleetPrinter[]>("/api/partner/printers"),
    enabled: isAuthenticated,
  });

  // Fetch Analytics
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["partner-analytics"],
    queryFn: () => api.get<Analytics>("/api/partner/analytics"),
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decline ticket");
    }
  };

  if (!isAuthenticated) return null;

  const updateStatus = async (orderId: number, status: string) => {
    const job = jobs.find(job => job.id === orderId);
    const shippingPackage = status === "packed" ? Object.fromEntries(PARCEL_FIELDS.map(({key}) => [key, Number(parcels[orderId]?.[key] ?? job?.shipping_package?.[key])])) : undefined;
    if (shippingPackage && Object.values(shippingPackage).some(value => !Number.isFinite(value) || value <= 0)) {
      toast.error("Enter the measured parcel dimensions and total weight before packing.");
      return;
    }
    setUpdatingId(orderId);
    try {
      await api.put(`/api/partner/jobs/${orderId}/status`, { status, ...(shippingPackage ? {shipping_package: shippingPackage} : {}) });
      toast.success(`Status updated: ${STATUS_LABEL[status] || status}`);
      queryClient.invalidateQueries({ queryKey: ["partner-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["partner-analytics"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
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
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Active jobs</p>
        <p className="text-3xl font-bold font-display text-foreground">{analytics?.active_jobs ?? 0}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" /> Printing
        </p>
        <p className="text-3xl font-bold font-display text-foreground">{jobs.filter(job => job.status === "printing").length}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" /> Ready / QC
        </p>
        <p className="text-3xl font-bold font-display text-foreground">{analytics?.pending_qc ?? 0}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-moss" /> Completed
        </p>
        <p className="text-3xl font-bold font-display text-foreground">{jobs.filter(job => job.status === "delivered").length}</p>
      </div>
      <div className="w-px h-12 bg-border hidden md:block" />
      <div className="flex-1 min-w-[120px] text-right">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Fleet printers</p>
        <p className="text-3xl font-bold font-display text-success">{analytics?.active_printers ?? 0}</p>
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
        {jobs.map((job) => {
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
                  <StatusChip status={getStatusType(job.status)} label={STATUS_LABEL[job.status] || job.status} />
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
                            {STATUS_LABEL[status]}
                          </div>
                          {idx < STATUS_FLOW.length - 1 && <div className={cn("w-6 h-px mx-1", isPast ? "bg-success" : "bg-border")} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {currentStepIndex === 0 || job.status === "paid" ? (
                  <div className="bg-moss/5 border border-moss/20 rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500 mt-4">
                    <h3 className="font-bold font-display text-2xl mb-2 text-foreground">New Job Request</h3>
                    <p className="text-sm text-muted-foreground mb-8">Review the requirements and accept the job to begin printing.</p>
                    
                    <Button disabled={updatingId === job.id} onClick={() => updateStatus(job.id, job.status === "paid" ? "queued" : "printing")} size="lg" className="rounded-xl px-12 shadow-lg hover-lift font-bold text-base">
                      {job.status === "paid" ? "Add to print queue" : "Accept job and start printing"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-bold mb-4 text-muted-foreground font-display">Items to Print</h3>
                      <div className="space-y-3">
                        {job.items?.map((item) => (
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
                      {job.status === "qc" && (
                        <fieldset className="mb-6 space-y-3">
                          <legend className="text-sm font-semibold mb-2">Measured packed parcel</legend>
                          <p className="text-sm text-muted-foreground">Measure the packed box and its total weight before creating the shipping label.</p>
                          <div className="grid grid-cols-2 gap-3">
                            {PARCEL_FIELDS.map(({key, label}) => (
                              <label key={key} className="text-sm flex flex-col gap-1">
                                {label}
                                <input type="number" min="0.001" step="any" required className="rounded-md border border-border bg-background p-2 font-data" value={parcels[job.id]?.[key] ?? job.shipping_package?.[key] ?? ""} onChange={event => setParcels(previous => ({...previous, [job.id]: {...previous[job.id], [key]: event.target.value}}))} />
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {STATUS_FLOW.map((status, idx) => {
                          const isPast = idx < currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          const isNext = idx === currentStepIndex + 1;
                          return (
                            <Button
                              key={status}
                              disabled={!isNext || updatingId === job.id}
                              onClick={() => updateStatus(job.id, status)}
                              variant={isPast ? "secondary" : isCurrent ? "glow" : isNext ? "outline" : "ghost"}
                              size="sm"
                              className={cn(isPast && "opacity-50", isCurrent && "ring-2 ring-moss/30", isNext && "border-moss text-moss hover:bg-moss hover:text-moss-ink")}
                            >
                              {ACTION_LABEL[status]}
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
              <p className="text-xs text-muted-foreground font-data mt-1">{formatDate(t.created_at)} · Fee {formatMoney(t.ticket_fee, "USD")}</p>
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
      {printers?.map((printer) => (
        <Card key={printer.id} className="p-6 border-border">
          <p className="text-xs text-muted-foreground mb-2">Registered printer</p>
          <h2 className="font-semibold">{printer.name}</h2>
          <p className="text-sm text-muted-foreground mt-2">Technology: {printer.technology}</p>
        </Card>
      ))}
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
