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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        label="Active Jobs"
        value={analytics?.active_jobs || 0}
        icon={PlayCircle}
        iconBg="bg-primary/15"
        iconColor="text-primary"
      />
      <StatCard
        label="Pending QC"
        value={analytics?.pending_qc || 0}
        icon={CheckCircle2}
        iconBg="bg-moss/15"
        iconColor="text-moss"
      />
      <StatCard
        label="Active Printers"
        value={analytics?.active_printers || 0}
        icon={Printer}
        iconBg="bg-success/15"
        iconColor="text-success"
      />
      <StatCard
        label="Maintenance Alerts"
        value={analytics?.maintenance_alerts || 0}
        icon={AlertTriangle}
        iconBg={analytics?.maintenance_alerts > 0 ? "bg-destructive/15" : "bg-muted"}
        iconColor={analytics?.maintenance_alerts > 0 ? "text-destructive" : "text-muted-foreground"}
      />
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
      <div className="space-y-6">
        {jobs.map((job: any) => {
          const currentStepIndex = STATUS_FLOW.indexOf(job.status);
          return (
            <Card key={job.id} className="overflow-hidden border-border bg-card">
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
                              isPast ? "bg-success-surface text-success-ink" : isCurrent ? "bg-primary-surface text-primary-ink ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
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
                            variant={isPast ? "secondary" : isCurrent ? "console" : isNext ? "outline" : "ghost"}
                            size="sm"
                            className={cn(isPast && "opacity-50", isCurrent && "ring-2 ring-primary/30")}
                          >
                            {status.toUpperCase()}
                          </Button>
                        );
                      })}
                    </div>
                    {job.tracking_url && (
                      <Card className="mt-6 p-4 border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold font-display">Shiprocket Info</p>
                        <a href={job.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm gap-2 font-semibold">
                          <Truck size={14} /> Track Shipment
                        </a>
                        <p className="text-xs text-muted-foreground mt-2 font-data">AWB / Order: {job.shiprocket_order_id}</p>
                      </Card>
                    )}
                  </div>
                </div>
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
    <Card className="p-0 overflow-hidden bg-card border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-muted-foreground">
          <thead className="bg-muted text-xs uppercase text-foreground">
            <tr>
              <th className="px-6 py-4 font-semibold">ID</th>
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Technology</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Last Maintenance</th>
            </tr>
          </thead>
          <tbody>
            {printers?.map((p: any) => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 font-data">#{p.id}</td>
                <td className="px-6 py-4 font-medium text-foreground">{p.name}</td>
                <td className="px-6 py-4">{p.technology}</td>
                <td className="px-6 py-4">
                  <StatusChip 
                    status={p.status === "active" ? "success" : p.status === "maintenance" ? "warning" : "neutral"} 
                    label={p.status.toUpperCase()} 
                  />
                </td>
                <td className="px-6 py-4 font-data">{p.last_maintenance_at ? new Date(p.last_maintenance_at).toLocaleDateString() : "Never"}</td>
              </tr>
            ))}
            {printers?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No printers assigned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const content = (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 font-display">
        <Settings className="text-primary" />
        Print Partner Dashboard
      </h1>

      {renderKPIs()}

      <div className="mb-6 border-b border-border flex gap-4">
        <button
          onClick={() => setActiveTab("jobs")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "jobs" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Package size={16} /> Job Queue
          </div>
          {activeTab === "jobs" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab("tickets")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "tickets" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Inbox size={16} /> Ticket Inbox
            {pendingTickets.length > 0 && (
              <span className="bg-primary-surface text-primary-ink text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {pendingTickets.length}
              </span>
            )}
          </div>
          {activeTab === "tickets" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab("fleet")}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors relative",
            activeTab === "fleet" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Printer size={16} /> Fleet Management
          </div>
          {activeTab === "fleet" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
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
