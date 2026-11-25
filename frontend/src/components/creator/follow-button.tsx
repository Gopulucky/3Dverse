"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

interface FollowState { following: boolean; follower_count: number }

/**
 * Follow / Following for one creator. Signed-out shoppers are sent to sign in and
 * come straight back. Nothing renders on a creator's own page.
 */
export function FollowButton({
  creatorId,
  creatorName,
  size = "default",
  next,
}: {
  creatorId: number;
  creatorName?: string;
  size?: "default" | "sm";
  /** Where to return after signing in. */
  next: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const key = ["follow", creatorId, user?.id];
  const state = useQuery({
    queryKey: key,
    queryFn: () => api.get<FollowState>(`/api/creators/${creatorId}/follow`),
    enabled: isAuthenticated && user?.id !== creatorId,
  });
  const toggle = useMutation({
    mutationFn: (following: boolean) =>
      following
        ? api.delete<FollowState>(`/api/creators/${creatorId}/follow`)
        : api.post<FollowState>(`/api/creators/${creatorId}/follow`),
    onSuccess: (result) => {
      queryClient.setQueryData(key, result);
      void queryClient.invalidateQueries({ queryKey: ["creator", creatorId] });
      toast.success(result.following
        ? `You'll hear when ${creatorName || "this creator"} posts a new design.`
        : `You unfollowed ${creatorName || "this creator"}.`);
    },
    onError: () => toast.error("Couldn't update that. Please try again."),
  });

  if (isAuthenticated && user?.id === creatorId) return null;

  const following = state.data?.following ?? false;
  const handle = () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    toggle.mutate(following);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={following ? "outline" : "default"}
      onClick={handle}
      disabled={toggle.isPending || (isAuthenticated && state.isLoading)}
      aria-pressed={following}
      data-state={following ? "following" : "not-following"}
      className="rounded-full"
    >
      {toggle.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        : following ? <Check size={16} aria-hidden="true" /> : <BellRing size={16} aria-hidden="true" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
