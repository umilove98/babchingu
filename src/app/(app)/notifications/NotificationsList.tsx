"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type Notification = {
  id: string;
  kind: "new_member" | "new_comment" | "change_requested" | "restaurant_changed" | "invited" | "left";
  partyId: string | null;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  partyLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

function describe(n: Notification): string {
  const label = n.partyLabel ?? "파티";
  const actor = n.actorName ?? "누군가";
  switch (n.kind) {
    case "new_member":
      return `${label} 파티에 ${actor} 님이 합류했어요`;
    case "new_comment":
      return `${label} 파티에 ${actor} 님이 댓글을 남겼어요`;
    case "change_requested": {
      const newName = (n.payload as { new_name?: string } | null)?.new_name;
      return `${label} 파티에 ${actor} 님이 식당 변경을 제안했어요${newName ? ` ('${newName}')` : ""}`;
    }
    case "restaurant_changed": {
      const p = n.payload as { before_name?: string; after_name?: string } | null;
      return `${label} 파티의 식당이 '${p?.before_name ?? "이전"}' → '${p?.after_name ?? "변경"}' 로 바뀌었어요`;
    }
    case "invited": {
      const inviteeName = (n.payload as { invitee_name?: string } | null)?.invitee_name ?? "당신";
      return `${actor} 님이 ${inviteeName} 님을 ${label} 파티에 초대했어요!`;
    }
    case "left":
      return `${label} 파티에서 ${actor} 님이 떠났어요`;
  }
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export function NotificationsList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ items: Notification[]; unread: number }>;
    },
    refetchInterval: 10000,
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const acceptInvite = useMutation({
    mutationFn: async ({ partyId, notifId }: { partyId: string; notifId: string }) => {
      const res = await fetch(`/api/parties/${partyId}/join`, { method: "POST" });
      if (!res.ok) throw new Error("참가 실패");
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [notifId] }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (isLoading) return <p className="text-center py-20 text-ink-soft">불러오는 중…</p>;

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-pop border-2 border-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-cream-deep">
        <p className="text-sm text-ink-soft">
          {unread > 0 ? `안 읽은 알림 ${unread}개` : "모두 확인했어요"}
        </p>
        {unread > 0 && (
          <Button size="sm" variant="soft" onClick={() => markAll.mutate()}>
            모두 읽음
          </Button>
        )}
      </div>
      <ul className="divide-y divide-cream-deep">
        {items.length === 0 ? (
          <li className="px-5 py-20 text-center text-ink-soft text-sm">아직 알림이 없어요</li>
        ) : (
          items.map((n) => {
            const showAccept = n.kind === "invited" && n.partyId && !n.readAt;
            return (
              <li key={n.id} className={cn(!n.readAt && "bg-butter/30")}>
                <Link
                  href={n.partyId ? `/party/${n.partyId}` : "#"}
                  className="block px-5 py-4 hover:bg-cream/60 transition"
                >
                  <p className="text-[15px] text-ink leading-snug">{describe(n)}</p>
                  <p className="text-[11px] text-ink-soft mt-1">{timeAgo(n.createdAt)}</p>
                </Link>
                {showAccept && (
                  <div className="px-5 pb-4">
                    <button
                      onClick={() =>
                        acceptInvite.mutate({ partyId: n.partyId!, notifId: n.id })
                      }
                      disabled={acceptInvite.isPending}
                      className="inline-flex items-center gap-1 bg-peach text-ink hover:bg-peach-deep hover:text-white text-sm font-bold px-4 py-2 rounded-lg shadow-[0_2px_0_0_rgba(74,74,107,0.15)] active:translate-y-0.5"
                    >
                      같이가기
                    </button>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
