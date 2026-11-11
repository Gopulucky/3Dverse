"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { cn, formatDate } from "@/lib/utils";
import { inboxGroup, nextAction, ticketLabel, ticketTone, type InboxGroup } from "@/lib/ticket-lifecycle";

export interface InboxTicket {
  id: number;
  workflow_status: string;
  product_reference?: string | null;
  overflow_reason?: string | null;
  created_at: string;
}

const GROUPS: { key: Exclude<InboxGroup, "hidden">; label: string; empty: string }[] = [
  { key: "action", label: "Needs action", empty: "Nothing needs your action right now." },
  { key: "progress", label: "In progress", empty: "No quotes or negotiations in progress." },
  { key: "closed", label: "Closed", empty: "No closed requests yet." },
];

const actionLink = "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium";

export function Inbox({ tickets, busyId, onAccept, onDecline }: {
  tickets: InboxTicket[];
  busyId: number | null;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
}) {
  const [group, setGroup] = useState<Exclude<InboxGroup, "hidden">>("action");
  const counts = Object.fromEntries(GROUPS.map(g => [g.key, tickets.filter(t => inboxGroup(t.workflow_status) === g.key).length]));
  const shown = tickets.filter(t => inboxGroup(t.workflow_status) === group);
  const current = GROUPS.find(g => g.key === group)!;
  return (
    <div data-flow="partner-inbox" data-state={group}>
      <div role="group" aria-label="Inbox filter" className="mb-4 flex flex-wrap gap-2">
        {GROUPS.map(g => (
          <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", group === g.key ? "border-moss bg-moss-surface text-moss-ink" : "border-border text-muted-foreground hover:text-foreground")}>
            {g.label} ({counts[g.key]})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card className="p-10 text-center"><p className="text-muted-foreground">{current.empty}</p></Card>
      ) : (
        <div className="space-y-3">
          {shown.map(t => {
            const next = nextAction(t.workflow_status);
            return (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-4 border-border bg-card p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">Ticket #{t.id}</p>
                    <StatusChip status={ticketTone(t.workflow_status)} label={ticketLabel(t.workflow_status)} />
                  </div>
                  <p className="text-sm text-muted-foreground">{t.product_reference || "Evaluation request"}</p>
                  {t.overflow_reason && <p className="mt-1 text-xs text-muted-foreground">Reason: <span className="capitalize">{t.overflow_reason.replace(/_/g, " ")}</span></p>}
                  <p className="mt-1 text-xs text-muted-foreground">Received {formatDate(t.created_at)}</p>
                  {next === "wait" && <p className="mt-1 text-xs text-muted-foreground">Waiting for the creator to send the design.</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {next === "accept" && <Button type="button" className="min-h-11" disabled={busyId === t.id} onClick={() => onAccept(t.id)}>Accept</Button>}
                  {next === "quote" && <Link href={`/collaboration/${t.id}`} className={cn(actionLink, "bg-moss text-white hover:opacity-90")}>Send quote</Link>}
                  <Link href={`/collaboration/${t.id}`} className={cn(actionLink, "border border-border hover:bg-muted")}>Open</Link>
                  {(next === "accept" || next === "quote" || next === "wait") && (
                    <Button type="button" variant="ghost" className="min-h-11 text-destructive" disabled={busyId === t.id} onClick={() => onDecline(t.id)}>Decline</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
