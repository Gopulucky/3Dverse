"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Notice {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: { product_id?: number } | null;
  created_at: string;
}

/** How many alerts are waiting. Shown on the account button. */
export function useUnreadNotifications(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count"),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return enabled ? data?.count ?? 0 : 0;
}

/** The latest alerts, opened from the account menu. */
export function NotificationsDialog({ open, onOpenChange, unread }: { open: boolean; onOpenChange: (open: boolean) => void; unread: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: () => api.get<Notice[]>("/api/notifications/", { limit: "10" }),
    enabled: open,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.post("/api/notifications/read-all"), onSuccess: refresh });

  const openNotice = (notice: Notice) => {
    if (!notice.read) markRead.mutate(notice.id);
    onOpenChange(false);
    if (notice.data?.product_id) router.push(`/marketplace/${notice.data.product_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>New designs from creators you follow, and other alerts.</DialogDescription>
        </DialogHeader>
        {unread > 0 && (
          <button type="button" onClick={() => markAll.mutate()} className="min-h-11 justify-self-start text-sm text-primary-ink underline">
            Mark all read
          </button>
        )}
        {isLoading ? (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : notices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Follow a creator and you&apos;ll hear here when they post a new design.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {notices.map((notice) => (
              <li key={notice.id}>
                <button type="button" onClick={() => openNotice(notice)} className="flex w-full items-start gap-2 py-3 text-left hover:bg-muted">
                  <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notice.read ? "bg-transparent" : "bg-ember")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", notice.read ? "font-normal" : "font-semibold")}>{notice.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{notice.message}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(notice.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
