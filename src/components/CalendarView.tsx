"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, MessageCircle, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
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
              pending={joinEatout.isPending || leaveEatout.isPending || joinDosirak.isPending || leaveDosirak.isPending}
            />
          ))}
        </div>
      )}

      {me.canHost && (
        <div className="flex justify-center pt-4">
          <Link href={`/register?week=${week}`}>
            <Button variant="primary" size="lg">
              이번 주 외식 등록·수정
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function DayColumn({
  day, me, onJoinDosirak, onLeaveDosirak, onJoinEatout, onLeaveEatout, pending,
}: {
  day: WeekData["days"][number];
  me: Me;
  onJoinDosirak: () => void;
  onLeaveDosirak: () => void;
  onJoinEatout: (id: string) => void;
  onLeaveEatout: (id: string) => void;
  pending: boolean;
}) {
  const today = isToday(day.date);
  const past = isPast(day.date);
  const dosirakJoined = day.dosirak.participants.some((p) => p.id === me.id);
  const isHoliday = Boolean(day.holiday);

  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-pop border-2 transition",
        isHoliday ? "border-bubblegum/60" : today ? "border-peach" : "border-white",
        past && "opacity-60 saturate-0",
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
                  joined={p.participants.some((x) => x.id === me.id)}
                  onJoin={() => onJoinEatout(p.id)}
                  onLeave={() => onLeaveEatout(p.id)}
                  pending={pending}
                />
              ))
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
  return (
    <div className="bg-butter rounded-xl p-3 border border-butter-deep transition hover:bg-cream-deep">
      <div className="flex items-center justify-between mb-2">
        <Link
          href={partyId ? `/party/${partyId}` : "#"}
          className={cn("flex items-center gap-1.5", !partyId && "pointer-events-none")}
        >
          <span className="font-bold text-sm">도시락</span>
        </Link>
        <JoinPill joined={joined} onJoin={onJoin} onLeave={onLeave} pending={pending} />
      </div>
      <div className="flex items-center justify-between">
        {participants.length === 0 ? (
          <span className="text-xs text-ink-soft/70">아무도 없어요 (쓸쓸)</span>
        ) : <span />}
        <span className="text-xs text-ink-soft font-medium">
          {participants.length}명
        </span>
      </div>
    </div>
  );
}

function EatoutCard({
  party, joined, onJoin, onLeave, pending,
}: {
  party: WeekData["days"][number]["eatouts"][number];
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
  pending: boolean;
}) {
  const tier = eatoutTier(party.participants.length);
  return (
    <div className={cn("rounded-xl p-3 border-2 transition", tier.bg, tier.border, tier.hover)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/party/${party.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-sm truncate">{party.restaurantName || "(이름 없음)"}</span>
          </div>
          {party.host && (
            <div className="flex items-center gap-1 text-[11px] text-ink-soft">
              <Avatar seed={party.host.avatarSeed} url={party.host.avatarUrl} size="sm" className="!w-4 !h-4 !ring-0" />
              <span className="truncate">{party.host.displayName}</span>
            </div>
          )}
        </Link>
        <JoinPill joined={joined} onJoin={onJoin} onLeave={onLeave} pending={pending} />
      </div>

      <div className="flex items-center justify-between">
        {party.participants.length === 0 ? (
          <span className="text-[11px] text-ink-soft/70">참가자 모집 중</span>
        ) : <span />}
        <div className="flex items-center gap-2 text-[11px] text-ink-soft">
          {party.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" /> {party.commentCount}
            </span>
          )}
          <span>{party.participants.length}명</span>
        </div>
      </div>

      {party.mapUrl && (
        <a
          href={party.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-sm font-semibold inline-flex items-center gap-1 text-ink-soft hover:text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="w-4 h-4" /> 위치보기 <ExternalLink className="w-3 h-3" />
        </a>
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
  if (count === 0) {
    return { bg: "bg-cream", border: "border-butter-deep", hover: "hover:bg-cream-deep" };
  }
  if (count <= 4) {
    return { bg: "bg-cream", border: "border-ink-soft", hover: "hover:bg-cream-deep" };
  }
  return { bg: "bg-cream", border: "border-ink", hover: "hover:bg-cream-deep" };
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
