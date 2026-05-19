"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, MessageCircle, MapPin, Plus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  currentIsoWeek,
  formatKoreanDate,
  isPast,
  isToday,
  mondayOfIsoWeek,
  shiftIsoWeek,
} from "@/lib/date";

type Me = {
  id: string;
  displayName: string;
  avatarSeed: string; avatarUrl?: string | null;
  canHost: boolean;
};

type Participant = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };

type WeekData = {
  week: string;
  monday: string;
  days: Array<{
    date: string;
    holiday: string | null;
    dosirak: {
      id: string | null;
      proposedId: string;
      participants: Participant[];
      commentCount: number;
    };
    eatouts: Array<{
      id: string;
      restaurantName: string;
      mapUrl: string;
      host: Participant | null;
      participants: Participant[];
      commentCount: number;
    }>;
  }>;
};

export function CalendarView({ me, initialWeek }: { me: Me; initialWeek: string }) {
  const [week, setWeek] = useState(initialWeek);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    setWeek(initialWeek);
  }, [initialWeek]);

  const { data, isLoading } = useQuery({
    queryKey: ["week", week],
    queryFn: async () => {
      const res = await fetch(`/api/parties/week?week=${week}`);
      if (!res.ok) throw new Error("주간 조회 실패");
      return res.json() as Promise<WeekData>;
    },
  });

  const joinEatout = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await fetch(`/api/parties/${partyId}/join`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "참가 실패");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week", week] }),
  });

  const leaveEatout = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await fetch(`/api/parties/${partyId}/join`, { method: "DELETE" });
      if (!res.ok) throw new Error("취소 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week", week] }),
  });

  const joinDosirak = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(`/api/parties/dosirak/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error("도시락 참가 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week", week] }),
  });

  const leaveDosirak = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(`/api/parties/dosirak/join`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error("도시락 취소 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week", week] }),
  });

  const movePartyDate = useMutation({
    mutationFn: async ({ partyId, newDate }: { partyId: string; newDate: string }) => {
      const res = await fetch(`/api/parties/${partyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partyDate: newDate }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "이동 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week", week] }),
  });

  function goWeek(delta: number) {
    const next = shiftIsoWeek(week, delta);
    setWeek(next);
    router.replace(next === currentIsoWeek() ? "/" : `/week/${next}`);
  }
  function goToday() {
    const today = currentIsoWeek();
    setWeek(today);
    router.replace("/");
  }

  const monday = data?.monday ?? mondayOfIsoWeek(week);
  const isCurrent = week === currentIsoWeek();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-base sm:text-lg tracking-tight text-ink">
            {fmtRange(monday)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goWeek(-1)}
            className="w-10 h-10 rounded-full bg-white hover:bg-cream-deep shadow-pop-sm flex items-center justify-center transition"
            aria-label="지난 주"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {!isCurrent && (
            <Button variant="soft" size="sm" onClick={goToday}>
              오늘로
            </Button>
          )}
          <button
            onClick={() => goWeek(1)}
            className="w-10 h-10 rounded-full bg-white hover:bg-cream-deep shadow-pop-sm flex items-center justify-center transition"
            aria-label="다음 주"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <SkeletonCalendar />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {data.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              me={me}
              onJoinDosirak={() => joinDosirak.mutate(day.date)}
              onLeaveDosirak={() => leaveDosirak.mutate(day.date)}
              onJoinEatout={(id) => joinEatout.mutate(id)}
              onLeaveEatout={(id) => leaveEatout.mutate(id)}
              onDropParty={(partyId) =>
                movePartyDate.mutate({ partyId, newDate: day.date })
              }
              onAddEatout={() => setAddingDate(day.date)}
              pending={joinEatout.isPending || leaveEatout.isPending || joinDosirak.isPending || leaveDosirak.isPending || movePartyDate.isPending}
            />
          ))}
        </div>
      )}

      {addingDate && (
        <AddEatoutModal
          date={addingDate}
          onClose={() => setAddingDate(null)}
          onSuccess={() => {
            setAddingDate(null);
            qc.invalidateQueries({ queryKey: ["week", week] });
          }}
        />
      )}

    </div>
  );
}

function DayColumn({
  day, me, onJoinDosirak, onLeaveDosirak, onJoinEatout, onLeaveEatout, onDropParty, onAddEatout, pending,
}: {
  day: WeekData["days"][number];
  me: Me;
  onJoinDosirak: () => void;
  onLeaveDosirak: () => void;
  onJoinEatout: (id: string) => void;
  onLeaveEatout: (id: string) => void;
  onDropParty: (partyId: string) => void;
  onAddEatout: () => void;
  pending: boolean;
}) {
  const today = isToday(day.date);
  const past = isPast(day.date);
  const dosirakJoined = day.dosirak.participants.some((p) => p.id === me.id);
  const isHoliday = Boolean(day.holiday);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (isHoliday) return;
        const partyId = e.dataTransfer.types.includes("application/x-party-id");
        if (!partyId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        if (isHoliday) return;
        const partyId = e.dataTransfer.getData("application/x-party-id");
        const srcDate = e.dataTransfer.getData("application/x-party-date");
        if (!partyId || srcDate === day.date) return;
        e.preventDefault();
        onDropParty(partyId);
      }}
      className={cn(
        "bg-white rounded-2xl shadow-pop border-2 transition",
        isHoliday ? "border-bubblegum/60" : today ? "border-peach" : "border-white",
        past && "opacity-60 saturate-0",
        dragOver && !isHoliday && "ring-2 ring-peach ring-offset-2",
      )}
    >
      <div
        className={cn(
          "px-4 py-2.5 rounded-t-[calc(0.625rem-2px)] flex items-center justify-between",
          isHoliday ? "bg-bubblegum/40 text-ink" : today ? "bg-peach text-white" : "bg-cream-deep text-ink",
        )}
      >
        <span className={cn("font-display font-bold text-lg", isHoliday && "text-bubblegum")}>
          {formatKoreanDate(day.date)}
        </span>
        {today && !isHoliday && (
          <span className="text-xs font-bold bg-white/40 px-2 py-0.5 rounded-full">오늘</span>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {isHoliday ? (
          <div className="text-center py-10">
            <p className="font-display font-bold text-2xl text-bubblegum">휴일</p>
            <p className="text-xs text-ink-soft mt-1">{day.holiday}</p>
          </div>
        ) : (
          <>
            {/* 도시락 슬롯 — 항상 표시 */}
            <DosirakCard
              participants={day.dosirak.participants}
              joined={dosirakJoined}
              partyId={day.dosirak.id}
              onJoin={onJoinDosirak}
              onLeave={onLeaveDosirak}
              pending={pending}
            />

            {/* 외식 카드들 */}
            {day.eatouts.length === 0 ? null : (
              day.eatouts.map((p) => (
                <EatoutCard
                  key={p.id}
                  party={p}
                  date={day.date}
                  joined={p.participants.some((x) => x.id === me.id)}
                  isMine={p.host?.id === me.id}
                  onJoin={() => onJoinEatout(p.id)}
                  onLeave={() => onLeaveEatout(p.id)}
                  pending={pending}
                />
              ))
            )}

            {/* +추가 버튼 (권한자, 미래·오늘만) */}
            {me.canHost && !past && (
              <button
                onClick={onAddEatout}
                className="w-full mt-1 py-2 rounded-xl border border-dashed border-butter-deep text-ink-soft hover:bg-cream-deep hover:text-ink hover:border-peach/50 transition inline-flex items-center justify-center gap-1 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DosirakCard({
  participants, joined, partyId, onJoin, onLeave, pending,
}: {
  participants: Participant[];
  joined: boolean;
  partyId: string | null;
  onJoin: () => void;
  onLeave: () => void;
  pending: boolean;
}) {
  const router = useRouter();
  const navigate = () => {
    if (partyId) router.push(`/party/${partyId}`);
  };
  return (
    <div
      role={partyId ? "link" : undefined}
      tabIndex={partyId ? 0 : -1}
      onClick={navigate}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && partyId) {
          e.preventDefault();
          navigate();
        }
      }}
      className={cn(
        "bg-white rounded-xl p-3 border border-butter-deep transition hover:bg-cream-deep/60",
        partyId && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-base">도시락</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <JoinPill joined={joined} onJoin={onJoin} onLeave={onLeave} pending={pending} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        {participants.length === 0 ? (
          <span className="text-xs text-ink-soft/70">아무도 없어요 (쓸쓸)</span>
        ) : <span />}
        <span className="text-sm text-ink font-semibold">
          {participants.length}명
        </span>
      </div>
    </div>
  );
}

function EatoutCard({
  party, date, joined, isMine, onJoin, onLeave, pending,
}: {
  party: WeekData["days"][number]["eatouts"][number];
  date: string;
  joined: boolean;
  isMine: boolean;
  onJoin: () => void;
  onLeave: () => void;
  pending: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const tier = eatoutTier(party.participants.length);
  const navigate = () => router.push(`/party/${party.id}`);
  const [dragging, setDragging] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const deleteParty = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? "삭제 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week"] }),
  });

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate();
        }
      }}
      onContextMenu={(e) => {
        if (!isMine) return;
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      draggable={isMine}
      onDragStart={(e) => {
        if (!isMine) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-party-id", party.id);
        e.dataTransfer.setData("application/x-party-date", date);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "rounded-xl p-3 border-2 transition cursor-pointer",
        tier.bg,
        tier.border,
        tier.hover,
        isMine && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
      title={isMine ? "드래그해서 다른 날로 이동 · 우클릭으로 삭제" : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-base truncate">{party.restaurantName || "(이름 없음)"}</span>
          </div>
          {party.host && (
            <div className="flex items-center gap-1 text-xs text-ink-soft">
              <Avatar seed={party.host.avatarSeed} url={party.host.avatarUrl} size="sm" className="!w-4 !h-4 !ring-0" />
              <span className="truncate">{party.host.displayName}</span>
            </div>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <JoinPill joined={joined} onJoin={onJoin} onLeave={onLeave} pending={pending} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {party.participants.length === 0 ? (
          <span className="text-xs text-ink-soft/70">참가자 모집 중</span>
        ) : <span />}
        <div className="flex items-center gap-2 text-sm text-ink">
          {party.commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-ink-soft">
              <MessageCircle className="w-3.5 h-3.5" /> {party.commentCount}
            </span>
          )}
          <span className="font-semibold">{party.participants.length}명</span>
        </div>
      </div>

      {party.mapUrl && (
        <a
          href={party.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs font-medium inline-flex items-center gap-1 text-ink-soft hover:text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="w-3 h-3" /> 위치보기 <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}

      {ctxMenu && (
        <div
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 60 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-lg shadow-pop-lg border border-ink/10 py-1 min-w-[120px] animate-pop-in"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCtxMenu(null);
              if (confirm(`'${party.restaurantName}' 파티를 삭제할까요? 참가자·댓글이 모두 사라져요.`)) {
                deleteParty.mutate();
              }
            }}
            disabled={deleteParty.isPending}
            className="block w-full text-left px-3 py-1.5 text-sm text-bubblegum hover:bg-bubblegum/10 font-semibold"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

function JoinPill({
  joined, onJoin, onLeave, pending,
}: {
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
  pending: boolean;
}) {
  return (
    <button
      onClick={joined ? onLeave : onJoin}
      disabled={pending}
      className={cn(
        "h-7 px-3 rounded-lg text-[11px] font-bold transition active:scale-95 inline-flex items-center",
        joined
          ? "bg-white text-ink-soft border border-ink/15 hover:border-bubblegum hover:text-bubblegum"
          : "bg-peach text-white hover:bg-peach-deep",
        pending && "opacity-50",
      )}
    >
      {joined ? "취소" : "참가"}
    </button>
  );
}

function eatoutTier(count: number) {
  // 게임 아이템 등급 — 인원이 늘어날수록 희귀
  if (count === 0) {
    return { bg: "bg-white", border: "border-zinc-200", hover: "hover:bg-zinc-50" };
  }
  if (count <= 2) {
    return { bg: "bg-white", border: "border-green-500", hover: "hover:bg-green-50" };
  }
  if (count <= 4) {
    return { bg: "bg-white", border: "border-blue-500", hover: "hover:bg-blue-50" };
  }
  if (count <= 6) {
    return { bg: "bg-white", border: "border-purple-500", hover: "hover:bg-purple-50" };
  }
  return { bg: "bg-white", border: "border-red-500", hover: "hover:bg-red-50" };
}

function AddEatoutModal({
  date, onClose, onSuccess,
}: {
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partyDate: date,
          restaurantName: name.trim(),
          mapUrl: mapUrl.trim() || undefined,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? "등록 실패");
    },
    onSuccess,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">{formatKoreanDate(date)} 외식 등록</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1 px-1">식당 이름</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 시오리"
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1 px-1">네이버 지도 링크 (선택)</label>
            <Input
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="https://map.naver.com/..."
            />
          </div>
          {add.error && <p className="text-bubblegum text-sm">{add.error.message}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={!name.trim() || add.isPending}>
              {add.isPending ? "등록 중…" : "등록"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SkeletonCalendar() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border-2 border-white p-3 h-48 animate-pulse">
          <div className="h-6 bg-cream-deep rounded-full w-2/3 mb-3" />
          <div className="h-16 bg-cream-deep/50 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function fmtRange(monday: string) {
  const [y, m, d] = monday.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 4));
  const f = (dt: Date) =>
    `${dt.getUTCFullYear()}년 ${String(dt.getUTCMonth() + 1).padStart(2, "0")}월 ${String(dt.getUTCDate()).padStart(2, "0")}일`;
  return `${f(start)} ~ ${f(end)}`;
}
