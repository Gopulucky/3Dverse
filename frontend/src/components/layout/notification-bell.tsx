"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Notice {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: { product_id?: number } | null;
  created_at: string;
}

/** The bell in the header: a count of unread alerts, and the latest ones when opened. */
export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: () => api.get<Notice[]>("/api/notifications/", { limit: "10" }),
    enabled: open,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.post("/api/notifications/read-all"), onSuccess: refresh });

  const count = unread?.count ?? 0;

  const openNotice = (notice: Notice) => {
    if (!notice.read) markRead.mutate(notice.id);
    if (notice.data?.product_id) router.push(`/marketplace/${notice.data.product_id}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          className="relative flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:bg-muted transition-colors"
        >
          <Bell size={22} aria-hidden="true" />
          {count > 0 && (
            <span className="absolute right-0.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 text-xs font-medium text-ember-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] p-2 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <button type="button" onClick={() => markAll.mutate()} className="min-h-8 text-sm text-primary-ink underline">
              Mark all read
            </button>
          )}
        </div>
        {isLoading ? (
          <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : notices.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Follow a creator and you&apos;ll hear here when they post a new design.
          </p>
        ) : (
          notices.map((notice) => (
            <DropdownMenuItem
              key={notice.id}
              onSelect={() => openNotice(notice)}
              className="cursor-pointer items-start gap-2 rounded-lg py-2"
            >
              <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notice.read ? "bg-transparent" : "bg-ember")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", notice.read ? "font-normal" : "font-semibold")}>{notice.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{notice.message}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(notice.created_at)}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
