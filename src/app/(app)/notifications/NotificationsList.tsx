"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type Notification = {
  id: string;
  kind: "new_member" | "new_comment" | "change_requested" | "restaurant_changed";
  partyId: string | null;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  partyLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

function describe(n: Notification): string {
  switch (n.kind) {
    case "new_member":
      return `🍱 ${n.actorName ?? "누군가"} 님이 ${n.partyLabel ?? "파티"}에 합류했어요!`;
    case "new_comment":
      return `💬 ${n.actorName ?? "누군가"} 님이 ${n.partyLabel ?? "파티"}에 댓글을 남겼어요`;
    case "change_requested": {
      const newName = (n.payload as { new_name?: string } | null)?.new_name;
      return `🔁 ${n.actorName ?? "누군가"} 님이 식당을 '${newName ?? "다른 곳"}'(으)로 바꾸자고 해요`;
    }
    case "restaurant_changed": {
      const p = n.payload as { before_name?: string; after_name?: string } | null;
      return `🏠 ${n.partyLabel ?? "파티"} 식당이 '${p?.before_name ?? "이전"}' → '${p?.after_name ?? "변경"}'(으)로 바뀌었어요`;
    }
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

  if (isLoading) return <p className="text-center py-20 text-ink-soft">불러오는 중…</p>;

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-pop border-2 border-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-cream-deep">
        <p className="text-sm text-ink-soft">
          {unread > 0 ? `안 읽은 알림 ${unread}개` : "모두 확인했어요 ✿"}
        </p>
        {unread > 0 && (
          <Button size="sm" variant="soft" onClick={() => markAll.mutate()}>
            모두 읽음
          </Button>
        )}
      </div>
      <ul className="divide-y divide-cream-deep">
        {items.length === 0 ? (
          <li className="px-5 py-20 text-center text-ink-soft text-sm">🌱 아직 알림이 없어요</li>
        ) : (
          items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.partyId ? `/party/${n.partyId}` : "#"}
                className={cn(
                  "block px-5 py-4 hover:bg-cream/60 transition",
                  !n.readAt && "bg-butter/30",
                )}
              >
                <p className="text-[15px] text-ink leading-snug">{describe(n)}</p>
                <p className="text-[11px] text-ink-soft mt-1">{timeAgo(n.createdAt)}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
