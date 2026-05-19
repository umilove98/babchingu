"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: "new_member" | "new_comment" | "change_requested" | "restaurant_changed" | "invited" | "left";
  partyId: string | null;
  actorName: string | null;
  actorSeed: string | null;
  payload: Record<string, unknown> | null;
  partyLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

const labels: Record<Notification["kind"], (n: Notification) => string> = {
  new_member: (n) =>
    `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 합류했어요`,
  new_comment: (n) =>
    `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 댓글을 남겼어요`,
  change_requested: (n) => {
    const newName = (n.payload as { new_name?: string } | null)?.new_name;
    return `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 식당 변경을 제안했어요${newName ? ` ('${newName}')` : ""}`;
  },
  restaurant_changed: (n) => {
    const p = n.payload as { before_name?: string; after_name?: string } | null;
    return `${n.partyLabel ?? "파티"} 파티의 식당이 '${p?.before_name ?? "이전"}' → '${p?.after_name ?? "변경"}' 로 바뀌었어요`;
  },
  invited: (n) => {
    const inviteeName = (n.payload as { invitee_name?: string } | null)?.invitee_name ?? "당신";
    return `${n.actorName ?? "누군가"} 님이 ${inviteeName} 님을 ${n.partyLabel ?? "파티"} 파티에 초대했어요!`;
  },
  left: (n) =>
    `${n.partyLabel ?? "파티"} 파티에서 ${n.actorName ?? "누군가"} 님이 떠났어요`,
};

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const prevUnreadRef = useRef<number>(0);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "same-origin" });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ items: Notification[]; unread: number }>;
    },
    refetchInterval: 8000,
  });

  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["week"] });
    },
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (unread > prevUnreadRef.current) {
      setWiggle(true);
      const t = setTimeout(() => setWiggle(false), 600);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-cream-deep transition",
          wiggle && "animate-wiggle",
        )}
        aria-label={`알림 ${unread}개`}
      >
        <Bell className="w-5 h-5 text-ink" strokeWidth={2.4} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1.5 rounded-full bg-bubblegum text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-cream animate-pop-in">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-pop-lg border-2 border-white overflow-hidden animate-pop-in">
          <div className="px-4 py-3 flex items-center justify-between border-b border-cream-deep">
            <span className="font-display font-bold text-lg">알림</span>
            {unread > 0 && (
              <button
                onClick={() => markRead.mutate(undefined)}
                className="text-xs text-ink-soft hover:text-ink font-semibold"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-ink-soft text-sm">
                아직 알림이 없어요
              </div>
            ) : (
              items.map((n) => {
                const text = labels[n.kind]?.(n) ?? "새 소식";
                const showAccept = n.kind === "invited" && n.partyId && !n.readAt;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "block px-4 py-3 border-b border-cream-deep/60 transition",
                      !n.readAt && "bg-butter/30",
                    )}
                  >
                    <Link
                      href={n.partyId ? `/party/${n.partyId}` : "#"}
                      onClick={() => {
                        if (!n.readAt) markRead.mutate([n.id]);
                        setOpen(false);
                      }}
                      className="block hover:bg-cream/40 -mx-4 -my-3 px-4 py-3"
                    >
                      <p className="text-sm text-ink leading-snug">{text}</p>
                      <p className="text-[11px] text-ink-soft mt-1">{timeAgo(n.createdAt)}</p>
                    </Link>
                    {showAccept && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptInvite.mutate({ partyId: n.partyId!, notifId: n.id });
                        }}
                        disabled={acceptInvite.isPending}
                        className="mt-2 inline-flex items-center gap-1 bg-peach text-ink hover:bg-peach-deep hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_2px_0_0_rgba(74,74,107,0.15)] active:translate-y-0.5"
                      >
                        같이가기
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <Link
            href="/notifications"
            className="block text-center py-3 text-xs font-semibold text-ink-soft hover:bg-cream-deep transition"
            onClick={() => setOpen(false)}
          >
            전체 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
