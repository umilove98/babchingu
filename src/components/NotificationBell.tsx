"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronLeft, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  currentPermission,
  disablePush,
  enablePush,
  getExistingSubscription,
  isPushSupported,
} from "@/lib/push-client";

type Notification = {
  id: string;
  kind:
    | "new_member"
    | "new_comment"
    | "change_requested"
    | "change_approved"
    | "change_rejected"
    | "restaurant_changed"
    | "invited"
    | "left"
    | "party_created";
  partyId: string | null;
  actorName: string | null;
  actorSeed: string | null;
  payload: Record<string, unknown> | null;
  partyLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

const labels: Record<Notification["kind"], (n: Notification) => string> = {
  new_member: (n) => {
    const guestName = (n.payload as { guest_name?: string } | null)?.guest_name;
    if (guestName) {
      return `${n.partyLabel ?? "파티"} 파티에 손님 ${guestName} 님이 합류했어요`;
    }
    return `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 합류했어요`;
  },
  new_comment: (n) =>
    `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 댓글을 남겼어요`,
  change_requested: (n) => {
    const newName = (n.payload as { new_name?: string } | null)?.new_name;
    return `${n.partyLabel ?? "파티"} 파티에 ${n.actorName ?? "누군가"} 님이 식당 변경을 제안했어요${newName ? ` ('${newName}')` : ""}`;
  },
  change_approved: (n) => {
    const newName = (n.payload as { new_name?: string } | null)?.new_name;
    return `${n.partyLabel ?? "파티"} 파티의 변경 제안이 승인되어 ${newName ? `'${newName}'` : "새 식당"} 으로 결정됐어요`;
  },
  change_rejected: (n) => {
    const newName = (n.payload as { new_name?: string } | null)?.new_name;
    return `${n.partyLabel ?? "파티"} 파티의 변경 제안${newName ? ` ('${newName}')` : ""} 이 거절됐어요`;
  },
  restaurant_changed: (n) => {
    const p = n.payload as { before_name?: string; after_name?: string } | null;
    return `${n.partyLabel ?? "파티"} 파티의 식당이 '${p?.before_name ?? "이전"}' → '${p?.after_name ?? "변경"}' 로 바뀌었어요`;
  },
  invited: (n) => {
    const inviteeName = (n.payload as { invitee_name?: string } | null)?.invitee_name ?? "당신";
    return `${n.actorName ?? "누군가"} 님이 ${inviteeName} 님을 ${n.partyLabel ?? "파티"} 파티에 초대했어요!`;
  },
  left: (n) => {
    const guestName = (n.payload as { guest_name?: string } | null)?.guest_name;
    if (guestName) {
      return `${n.partyLabel ?? "파티"} 파티에서 손님 ${guestName} 님이 떠났어요`;
    }
    return `${n.partyLabel ?? "파티"} 파티에서 ${n.actorName ?? "누군가"} 님이 떠났어요`;
  },
  party_created: (n) =>
    `${n.actorName ?? "누군가"} 님이 ${n.partyLabel ?? "새 파티"} 를 열었어요`,
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
  const [settingsView, setSettingsView] = useState(false);
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
    refetchInterval: 30000,
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
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-pop-lg border-2 border-white overflow-hidden animate-pop-in">
          <div className="px-4 py-3 flex items-center justify-between border-b border-cream-deep">
            {settingsView ? (
              <button
                onClick={() => setSettingsView(false)}
                className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="font-display font-bold text-lg">알림 설정</span>
              </button>
            ) : (
              <span className="font-display font-bold text-lg">알림</span>
            )}
            <div className="flex items-center gap-3">
              {!settingsView && unread > 0 && (
                <button
                  onClick={() => markRead.mutate(undefined)}
                  className="text-xs text-ink-soft hover:text-ink font-semibold"
                >
                  모두 읽음
                </button>
              )}
              {!settingsView && (
                <button
                  onClick={() => setSettingsView(true)}
                  className="text-ink-soft hover:text-ink"
                  aria-label="알림 설정"
                  title="알림 설정"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {settingsView ? (
            <NotificationSettingsPanel />
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Prefs = {
  notifParticipants: boolean;
  notifComments: boolean;
  notifNewParties: boolean;
};

function NotificationSettingsPanel() {
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const res = await fetch("/api/me/preferences");
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<Prefs>;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const res = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("저장 실패");
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["notif-prefs"] });
      const prev = qc.getQueryData<Prefs>(["notif-prefs"]);
      if (prev) qc.setQueryData<Prefs>(["notif-prefs"], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notif-prefs"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });

  return (
    <div className="px-4 py-3 space-y-4 max-h-96 overflow-y-auto">
      <PushPermissionToggle />

      <div className="space-y-1">
        <p className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">받을 알림</p>
        {isLoading || !prefs ? (
          <p className="text-xs text-ink-soft py-2">불러오는 중…</p>
        ) : (
          <ul className="divide-y divide-cream-deep/60">
            <ToggleRow
              label="참가자 추가·제거"
              hint="누군가 합류하거나 떠났을 때"
              checked={prefs.notifParticipants}
              onChange={(v) => update.mutate({ notifParticipants: v })}
            />
            <ToggleRow
              label="댓글"
              hint="메뉴토론방에 새 메시지"
              checked={prefs.notifComments}
              onChange={(v) => update.mutate({ notifComments: v })}
            />
            <ToggleRow
              label="새 외식 파티 개설"
              hint="누군가 새 외식을 열었을 때"
              checked={prefs.notifNewParties}
              onChange={(v) => update.mutate({ notifNewParties: v })}
            />
          </ul>
        )}
        <p className="text-[11px] text-ink-soft/80 pt-2 leading-snug">
          ※ 초대·식당 변경 제안·승인 결과는 항상 받아요
        </p>
      </div>
    </div>
  );
}

function ToggleRow({
  label, hint, checked, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between py-2.5 gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-[11px] text-ink-soft truncate">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </li>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex w-10 h-6 rounded-full transition shrink-0",
        checked ? "bg-peach" : "bg-ink/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

function PushPermissionToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 브라우저 API 탐지 — hydration 후 mount-only 1회. cascading-render 경고는 의도된 동작.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isPushSupported());
    setPermission(currentPermission());
    (async () => {
      const sub = await getExistingSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  if (!supported) {
    return (
      <div className="bg-cream/60 rounded-lg p-3 text-xs text-ink-soft">
        이 브라우저는 푸시 알림을 지원하지 않아요
      </div>
    );
  }
  if (permission === "denied") {
    return (
      <div className="bg-cream/60 rounded-lg p-3 text-xs text-ink-soft leading-snug">
        브라우저에서 알림이 차단되어 있어요. 주소창 좌측 자물쇠 아이콘에서 허용으로 바꿔주세요.
      </div>
    );
  }

  const on = permission === "granted" && subscribed;

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setSubscribed(false);
      } else {
        const ok = await enablePush();
        setPermission(currentPermission());
        setSubscribed(ok);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-butter/40 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">브라우저 푸시 알림</p>
        <p className="text-[11px] text-ink-soft truncate">
          {on ? "이 기기에서 받고 있어요" : "탭을 닫아도 OS 알림으로 받기"}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={cn(
          "text-xs font-bold rounded-lg px-3 py-1.5 transition disabled:opacity-50",
          on
            ? "bg-white border border-ink/15 text-ink hover:bg-cream"
            : "bg-peach text-ink hover:bg-peach-deep hover:text-white",
        )}
      >
        {busy ? "…" : on ? "끄기" : "켜기"}
      </button>
    </div>
  );
}
