"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Send,
  User as UserIcon,
  Loader2,
  CheckCircle,
  Clock,
  Wand2,
  Download,
  Package,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/stores/auth-store";
import { MarketplaceShell } from "@/components/layout/marketplace-shell";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

const STATUS_TYPE: Record<string, "success" | "warning" | "in-progress" | "danger" | "neutral"> = {
  pending_payment: "warning",
  submitted: "warning",
  accepted: "in-progress",
  quoted: "in-progress",
  negotiating: "in-progress",
  agreed: "in-progress",
  delivered: "success",
  completed: "success",
  declined: "danger",
  cancelled: "neutral",
};

const EMPTY_PROPOSAL = {
  design_fee: "",
  revisions_included: "2",
  delivery_days: "",
  print_unit_price: "",
  scope_notes: "",
};

const EMPTY_ADDRESS = { name: "", street: "", city: "", zip: "", country: "US" };

export default function CommissionDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const { ready, user } = useRequireAuth();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [proposalForm, setProposalForm] = useState(EMPTY_PROPOSAL);
  const [conceptFile, setConceptFile] = useState<File | null>(null);
  const [proposalSubmitting, setProposalSubmitting] = useState(false);

  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [delivering, setDelivering] = useState(false);

  const [revisionNote, setRevisionNote] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchDetails = async () => {
    try {
      setData(await api.get<any>(`/api/custom-designs/requests/${requestId}`));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessages(await api.get<any[]>(`/api/custom-designs/requests/${requestId}/messages`));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!ready) return;
    Promise.all([fetchDetails(), fetchMessages()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchDetails();
      fetchMessages();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!ready || loading) {
    return (
      <MarketplaceShell>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="animate-spin" size={18} /> Loading commission…
        </div>
      </MarketplaceShell>
    );
  }

  if (!data) {
    return (
      <MarketplaceShell>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
          Request not found or you don&apos;t have access to it.
        </div>
      </MarketplaceShell>
    );
  }

  const { request, proposal, agreement, creator_name, customer_name, viewer_side } = data;
  const isCreator = viewer_side === "creator";
  const status = request.workflow_status as string;
  const counterpartyName = isCreator ? customer_name : creator_name;

  const run = async (fn: () => Promise<any>, successMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      await Promise.all([fetchDetails(), fetchMessages()]);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage("");
    try {
      await api.post(`/api/custom-designs/requests/${requestId}/messages`, { content });
      fetchMessages();
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
    }
  };

  const handleAccept = () => run(() => api.post(`/api/custom-designs/requests/${requestId}/accept`));

  const handleDecline = () => {
    const reason = window.prompt("Reason for declining this request:");
    if (!reason || !reason.trim()) return;
    run(() =>
      api.post(`/api/custom-designs/requests/${requestId}/decline`, { reason: reason.trim() })
    );
  };

  const handleCancel = () =>
    run(() => api.post(`/api/custom-designs/requests/${requestId}/cancel`));

  const handleSubmitProposal = async () => {
    if (!proposalForm.design_fee || !proposalForm.delivery_days) {
      toast.error("Design fee and delivery days are required.");
      return;
    }
    if (request.intent === "print_too" && !proposalForm.print_unit_price) {
      toast.error("This customer wants a physical print too — add a per-unit print price.");
      return;
    }
    setProposalSubmitting(true);
    try {
      const qs = new URLSearchParams({
        design_fee: proposalForm.design_fee,
        revisions_included: proposalForm.revisions_included || "2",
        delivery_days: proposalForm.delivery_days,
      });
      if (proposalForm.print_unit_price) qs.set("print_unit_price", proposalForm.print_unit_price);
      if (proposalForm.scope_notes) qs.set("scope_notes", proposalForm.scope_notes);

      const formData = new FormData();
      if (conceptFile) formData.append("file", conceptFile);

      await api.upload(`/api/custom-designs/requests/${requestId}/proposal?${qs.toString()}`, formData);
      setProposalForm(EMPTY_PROPOSAL);
      setConceptFile(null);
      toast.success("Proposal sent");
      await Promise.all([fetchDetails(), fetchMessages()]);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit proposal");
    } finally {
      setProposalSubmitting(false);
    }
  };

  const handleConfirmAgreement = () => {
    const finalPrice = proposal?.design_fee;
    if (!finalPrice) return;
    run(
      () =>
        api.post(`/api/custom-designs/requests/${requestId}/agree`, { final_price: finalPrice }),
      "Confirmed"
    );
  };

  const handlePayDesignFee = () =>
    run(() => api.post(`/api/custom-designs/requests/${requestId}/pay-design-fee`), "Design fee paid");

  const handleDeliver = async () => {
    if (!deliveryFile) {
      toast.error("Attach the final design file first.");
      return;
    }
    setDelivering(true);
    try {
      const formData = new FormData();
      formData.append("file", deliveryFile);
      await api.upload(`/api/custom-designs/requests/${requestId}/deliver`, formData);
      setDeliveryFile(null);
      toast.success("Design delivered");
      await Promise.all([fetchDetails(), fetchMessages()]);
    } catch (e: any) {
      toast.error(e.message || "Failed to deliver design");
    } finally {
      setDelivering(false);
    }
  };

  const handleDownload = () =>
    api
      .download(`/api/downloads/custom-designs/${requestId}/final`, request.final_design_name)
      .catch((e) => toast.error(e.message));

  const handleRequestRevision = () => {
    if (!revisionNote.trim()) {
      toast.error("Describe what needs changing.");
      return;
    }
    run(
      () =>
        api.post(`/api/custom-designs/requests/${requestId}/revision`, {
          note: revisionNote.trim(),
        }),
      "Revision requested"
    ).then(() => setRevisionNote(""));
  };

  const handleComplete = () =>
    run(() => api.post(`/api/custom-designs/requests/${requestId}/complete`), "Marked complete");

  const handleOrderPrint = async () => {
    if (!address.name || !address.street || !address.city || !address.zip) {
      toast.error("Fill in the full shipping address.");
      return;
    }
    setOrdering(true);
    try {
      const res = await api.post<{ order_id: number }>(
        `/api/custom-designs/requests/${requestId}/order-print`,
        { shipping_address: address, quantity: 1 }
      );
      toast.success("Print order placed!");
      router.push(`/orders`);
    } catch (e: any) {
      toast.error(e.message || "Failed to place print order");
    } finally {
      setOrdering(false);
    }
  };

  const revisionsLeft = proposal ? proposal.revisions_included - request.revisions_used : 0;

  return (
    <MarketplaceShell>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Wand2 className="text-primary" size={22} />
              {request.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isCreator ? "Customer" : "Creator"}: <span className="font-semibold">{counterpartyName}</span>{" "}
              · Request #{request.id}
            </p>
          </div>
          <StatusChip
            status={STATUS_TYPE[status] || "neutral"}
            label={status.replace(/_/g, " ").toUpperCase()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Chat */}
          <div className="bg-card border border-border rounded-xl flex flex-col h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-semibold mb-1">Brief</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{request.brief}</p>
                {request.reference_image_url && (
                  <button
                    onClick={() =>
                      api
                        .download(`/api/downloads/custom-designs/${requestId}/reference`, "reference")
                        .catch((e) => toast.error(e.message))
                    }
                    className="text-primary text-xs font-semibold mt-2 hover:underline"
                  >
                    Download reference image
                  </button>
                )}
              </div>

              {messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">
                  No messages yet — say hello.
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-border p-3 flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={status === "pending_payment" ? "Pay the brief fee to start chatting" : "Type a message"}
                disabled={status === "pending_payment"}
                className="flex-1 h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || status === "pending_payment"}>
                <Send size={16} />
              </Button>
            </form>
          </div>

          {/* Action panel */}
          <div className="space-y-4">
            {/* Customer: pay brief fee */}
            {!isCreator && status === "pending_payment" && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-semibold mb-1">Brief fee unpaid</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Pay the ${request.brief_fee.toFixed(2)} brief fee so {creator_name} can review your request.
                </p>
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => run(() => api.post(`/api/custom-designs/requests/${requestId}/pay`))}
                >
                  Pay ${request.brief_fee.toFixed(2)}
                </Button>
              </div>
            )}

            {/* Creator: accept/decline */}
            {isCreator && status === "submitted" && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-2">
                <p className="text-sm font-semibold mb-1">New request</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Review the brief, then accept to start scoping a quote or decline with a reason.
                </p>
                <Button className="w-full" disabled={busy} onClick={handleAccept}>
                  <CheckCircle size={16} /> Accept
                </Button>
                <Button variant="outline" className="w-full" disabled={busy} onClick={handleDecline}>
                  <XCircle size={16} /> Decline
                </Button>
              </div>
            )}

            {/* Customer: cancel while unpriced */}
            {!isCreator && ["submitted", "accepted"].includes(status) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground mb-3">
                  Waiting on {creator_name} to send a quote.
                </p>
                <Button variant="outline" size="sm" disabled={busy} onClick={handleCancel}>
                  Cancel request
                </Button>
              </div>
            )}

            {/* Creator: proposal form */}
            {isCreator && ["accepted", "quoted", "negotiating"].includes(status) && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> Send a Quote
                </p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Design fee ($)</label>
                  <input
                    type="number"
                    value={proposalForm.design_fee}
                    onChange={(e) => setProposalForm({ ...proposalForm, design_fee: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Delivery time (days)</label>
                  <input
                    type="number"
                    value={proposalForm.delivery_days}
                    onChange={(e) => setProposalForm({ ...proposalForm, delivery_days: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Revisions included</label>
                  <input
                    type="number"
                    value={proposalForm.revisions_included}
                    onChange={(e) => setProposalForm({ ...proposalForm, revisions_included: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                {request.intent === "print_too" && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Per-unit print price ($)</label>
                    <input
                      type="number"
                      value={proposalForm.print_unit_price}
                      onChange={(e) => setProposalForm({ ...proposalForm, print_unit_price: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Scope notes (optional)</label>
                  <textarea
                    value={proposalForm.scope_notes}
                    onChange={(e) => setProposalForm({ ...proposalForm, scope_notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Concept image (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setConceptFile(e.target.files?.[0] || null)}
                    className="text-xs text-muted-foreground"
                  />
                </div>
                <Button className="w-full" disabled={proposalSubmitting} onClick={handleSubmitProposal}>
                  {proposalSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
                  Send Quote
                </Button>
              </div>
            )}

            {/* Proposal summary, both sides */}
            {proposal && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-semibold mb-3">Current Quote</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Design fee</span>
                    <span className="font-data font-semibold">${proposal.design_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="font-data">{proposal.delivery_days} day(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revisions included</span>
                    <span className="font-data">{proposal.revisions_included}</span>
                  </div>
                  {proposal.print_unit_price && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Print price/unit</span>
                      <span className="font-data">${proposal.print_unit_price.toFixed(2)}</span>
                    </div>
                  )}
                  {proposal.scope_notes && (
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border mt-2">
                      {proposal.scope_notes}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Agreement */}
            {proposal && ["quoted", "negotiating", "agreed"].includes(status) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-semibold mb-2">Finalize Agreement</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Both sides must confirm the ${proposal.design_fee.toFixed(2)} design fee to lock it in.
                </p>
                {status !== "agreed" && (
                  <Button className="w-full mb-3" disabled={busy} onClick={handleConfirmAgreement}>
                    Confirm ${proposal.design_fee.toFixed(2)}
                  </Button>
                )}
                {agreement && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      {agreement.customer_confirmed ? (
                        <span className="flex items-center gap-1 text-moss">
                          <CheckCircle size={12} /> Confirmed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-ember">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Creator</span>
                      {agreement.creator_confirmed ? (
                        <span className="flex items-center gap-1 text-moss">
                          <CheckCircle size={12} /> Confirmed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-ember">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer: pay design fee once agreed */}
            {!isCreator && status === "agreed" && request.design_fee_status !== "completed" && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-semibold mb-1">Pay the design fee</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {creator_name} starts work once the ${proposal?.design_fee.toFixed(2)} design fee is paid.
                </p>
                <Button className="w-full" disabled={busy} onClick={handlePayDesignFee}>
                  Pay ${proposal?.design_fee.toFixed(2)}
                </Button>
              </div>
            )}

            {/* Creator: deliver */}
            {isCreator && status === "agreed" && request.design_fee_status === "completed" && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold">Deliver the Design</p>
                <input
                  type="file"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground"
                />
                <Button className="w-full" disabled={delivering} onClick={handleDeliver}>
                  {delivering ? <Loader2 className="animate-spin" size={16} /> : null}
                  Upload & Deliver
                </Button>
              </div>
            )}
            {isCreator && status === "agreed" && request.design_fee_status !== "completed" && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground">
                  Waiting on {customer_name} to pay the design fee before you deliver.
                </p>
              </div>
            )}

            {/* Delivered — customer actions */}
            {!isCreator && (status === "delivered" || status === "completed") && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Package size={16} className="text-moss" /> Design Delivered
                </p>
                <Button className="w-full" onClick={handleDownload}>
                  <Download size={16} /> Download {request.final_design_name}
                </Button>

                {status === "delivered" && (
                  <>
                    {revisionsLeft > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          {revisionsLeft} revision{revisionsLeft === 1 ? "" : "s"} left
                        </p>
                        <textarea
                          value={revisionNote}
                          onChange={(e) => setRevisionNote(e.target.value)}
                          rows={2}
                          placeholder="What needs to change?"
                          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                        />
                        <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={handleRequestRevision}>
                          Request Revision
                        </Button>
                      </div>
                    )}
                    <Button variant="secondary" className="w-full" disabled={busy} onClick={handleComplete}>
                      Accept Delivery
                    </Button>
                  </>
                )}

                {request.intent === "print_too" && proposal?.print_unit_price && !request.print_order_id && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Want it printed? ${proposal.print_unit_price.toFixed(2)}/unit + shipping.
                    </p>
                    {!showOrderForm ? (
                      <Button variant="outline" className="w-full" onClick={() => setShowOrderForm(true)}>
                        Order a Physical Print
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          placeholder="Full name"
                          value={address.name}
                          onChange={(e) => setAddress({ ...address, name: e.target.value })}
                          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                        />
                        <input
                          placeholder="Street address"
                          value={address.street}
                          onChange={(e) => setAddress({ ...address, street: e.target.value })}
                          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="City"
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                          />
                          <input
                            placeholder="ZIP"
                            value={address.zip}
                            onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                            className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                          />
                        </div>
                        <Button className="w-full" disabled={ordering} onClick={handleOrderPrint}>
                          {ordering ? <Loader2 className="animate-spin" size={16} /> : null}
                          Place Print Order
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {request.print_order_id && (
                  <p className="text-xs text-moss pt-2 border-t border-border">
                    Print order placed — see it in your{" "}
                    <a href="/orders" className="underline font-semibold">
                      order history
                    </a>
                    .
                  </p>
                )}
              </div>
            )}

            {status === "declined" && request.decline_reason && (
              <div className="bg-destructive/10 border border-danger-red/20 rounded-xl p-5">
                <p className="text-sm font-semibold text-destructive mb-1">Declined</p>
                <p className="text-xs text-muted-foreground">{request.decline_reason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MarketplaceShell>
  );
}
