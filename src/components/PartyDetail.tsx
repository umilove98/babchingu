"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Copy, ExternalLink, MapPin, Send, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UserTrigger } from "@/components/UserTrigger";
import { cn } from "@/lib/utils";
import { formatKoreanDate } from "@/lib/date";
import { getSupabaseBrowser } from "@/lib/supabase-client";

type Me = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null; canHost: boolean };
type Person = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
type Comment = { id: string; body: string; createdAt: string; user: Person };
type ChangeRequest = {
  id: string;
  newName: string;
  newMapUrl: string | null;
  reason: string | null;
  requester: Person;
  createdAt: string;
};
type Guest = { id: string; name: string };
type Party = {
  id: string;
  partyDate: string;
  kind: "dosirak" | "eatout";
  restaurantName: string | null;
  mapUrl: string | null;
  host: Person | null;
  participants: Person[];
  guests: Guest[];
  comments: Comment[];
  pendingRequests: ChangeRequest[];
};

export function PartyDetail({ me, partyId }: { me: Me; partyId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["party", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<Party>;
    },
  });

  // 실시간 — 이 파티의 참가자·손님·댓글·변경제안·식당명 변경을 자동 반영
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["party", partyId] });
    const filter = `partyId=eq.${partyId}`;
    const channel = sb
      .channel(`party-${partyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "Participation", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "GuestParticipation", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "Comment", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "RestaurantChangeRequest", filter }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "Party", filter: `id=eq.${partyId}` }, invalidate)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [partyId, qc]);

  const join = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/join`, { method: "POST" });
      if (!res.ok) throw new Error("참가 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party", partyId] }),
  });
  const leave = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/join`, { method: "DELETE" });
      if (!res.ok) throw new Error("취소 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party", partyId] }),
  });

  const deleteParty = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}`, { method: "DELETE" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? "삭제 실패");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["week"] });
      router.replace("/");
    },
  });

  if (isLoading) return <p className="text-center py-20 text-ink-soft">불러오는 중…</p>;
  if (error) return <p className="text-center py-20 text-bubblegum">불러오기 실패</p>;
  if (!data) {
    return (
      <EmptyDosirak
        partyId={partyId}
        onCreate={() => join.mutate()}
      />
    );
  }

  const joined = data.participants.some((p) => p.id === me.id);
  const isHost = data.host?.id === me.id;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <Link href="/" className="inline-flex items-center text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="w-4 h-4" /> 주간 캘린더
      </Link>

      <header
        className={cn(
          "rounded-2xl p-6 border-2 shadow-pop relative",
          data.kind === "dosirak" ? "bg-mint/50 border-mint" : "bg-butter/60 border-butter",
        )}
      >
        {isHost && data.kind === "eatout" && (
          <button
            onClick={() => {
              if (confirm("이 파티를 정말 삭제할까요? 참가자·댓글이 모두 함께 사라져요.")) {
                deleteParty.mutate();
              }
            }}
            disabled={deleteParty.isPending}
            className="absolute top-4 right-4 inline-flex items-center gap-1 text-xs font-semibold text-bubblegum hover:bg-white/60 rounded-md px-2 py-1 transition disabled:opacity-50"
            title="파티 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" /> 삭제
          </button>
        )}
        <p className="text-sm text-ink-soft font-medium mb-1">{formatKoreanDate(data.partyDate)}</p>
        <h1 className="font-display font-bold text-3xl">
          {data.kind === "dosirak" ? "도시락" : (data.restaurantName ?? "외식")}
        </h1>
        {data.kind === "eatout" && data.host && (
          <div className="flex items-center gap-2 mt-3 text-sm flex-wrap">
            <UserTrigger userId={data.host.id}>
              <Avatar seed={data.host.avatarSeed} url={data.host.avatarUrl} size="sm" />
              <span className="text-ink-soft">파티장 <strong className="text-ink">{data.host.displayName}</strong></span>
            </UserTrigger>
            {isHost && data.participants.length > 0 && (
              <DelegateHostButton
                partyId={partyId}
                participants={data.participants.filter((p) => p.id !== me.id)}
              />
            )}
          </div>
        )}
        {data.mapUrl && (
          <a
            href={data.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold text-ink-soft hover:text-ink"
          >
            <MapPin className="w-5 h-5" /> 위치보기 <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-1.5">함께 가요 ({data.participants.length + data.guests.length}명)</p>
            <div className="flex flex-wrap gap-2">
              {data.participants.length === 0 && data.guests.length === 0 ? (
                <span className="text-sm text-ink-soft/70">아직 아무도 없어요. 첫 주자가 되어보세요!</span>
              ) : (
                <>
                  {data.participants.map((p) => (
                    <UserTrigger
                      key={p.id}
                      userId={p.id}
                      className="bg-white/70 pl-1 pr-3 py-1 rounded-full"
                    >
                      <Avatar seed={p.avatarSeed} url={p.avatarUrl} size="sm" />
                      <span className="text-xs font-semibold">{p.displayName}</span>
                    </UserTrigger>
                  ))}
                  {data.guests.map((g) => (
                    <div key={g.id} className="flex items-center gap-1.5 bg-white/60 pl-2.5 pr-3 py-1 rounded-full border border-dashed border-ink/15">
                      <span className="text-xs font-semibold text-ink-soft">손님</span>
                      <span className="text-xs font-semibold">{g.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <Button
              variant={joined ? "outline" : "primary"}
              onClick={() => (joined ? leave.mutate() : join.mutate())}
              disabled={join.isPending || leave.isPending}
              className="whitespace-nowrap"
            >
              <span className="sm:hidden">{joined ? "취소" : "참가"}</span>
              <span className="hidden sm:inline">{joined ? "참가 취소" : "나도 참가"}</span>
            </Button>
            {(joined || isHost) && (
              <InviteButton partyId={partyId} />
            )}
          </div>
        </div>
      </header>

      {data.kind === "eatout" && (
        <ChangeRequestsSection
          partyId={partyId}
          myId={me.id}
          isHost={isHost}
          pendingRequests={data.pendingRequests}
          currentName={data.restaurantName ?? ""}
        />
      )}

      <CommentsSection partyId={partyId} comments={data.comments} me={me} />
    </div>
  );
}

function EmptyDosirak({ partyId, onCreate }: { partyId: string; onCreate: () => void }) {
  // 결정적 ID 패턴 dos_YYYY-MM-DD 를 디코딩
  const m = /^dos_(\d{4}-\d{2}-\d{2})$/.exec(partyId);
  const date = m?.[1];
  return (
    <div className="max-w-md mx-auto text-center py-20 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl">
          {date ? formatKoreanDate(date) : ""} 도시락
        </h1>
        <p className="text-ink-soft mt-2 text-sm">아직 참가자가 없어요. 첫 주자가 되어보세요!</p>
      </div>
      <Button size="lg" onClick={onCreate}>
        첫 참가자 되기
      </Button>
      <p className="text-xs text-ink-soft">
        <Link href="/" className="hover:underline">← 캘린더로 돌아가기</Link>
      </p>
    </div>
  );
}

function CommentsSection({
  partyId, comments, me,
}: {
  partyId: string;
  comments: Comment[];
  me: Me;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("메시지 전송 실패");
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["party", partyId] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parties/${partyId}/comments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party", partyId] }),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  return (
    <section className="bg-white rounded-2xl shadow-pop border-2 border-white overflow-hidden">
      <header className="px-5 py-3 border-b border-cream-deep flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-peach" />
        <h2 className="font-display font-bold text-lg">메뉴토론방</h2>
        <span className="text-xs text-ink-soft ml-auto">{comments.length}개의 메시지</span>
      </header>
      <div
        ref={scrollRef}
        className="bg-cream-deep/40 px-4 py-4 max-h-[28rem] overflow-y-auto"
      >
        {comments.length === 0 ? (
          <p className="text-sm text-ink-soft/70 text-center py-12">
            아직 메시지가 없어요.<br />메뉴 얘기 먼저 꺼내볼까요?
          </p>
        ) : (
          <ul>
            {comments.map((c, i) => {
              const isMine = c.user.id === me.id;
              const prev = comments[i - 1];
              const next = comments[i + 1];
              const sameAsPrev = prev && prev.user.id === c.user.id && withinMinutes(prev.createdAt, c.createdAt, 5);
              const sameAsNext = next && next.user.id === c.user.id && withinMinutes(c.createdAt, next.createdAt, 5);
              const showHeader = !sameAsPrev;
              const showTime = !sameAsNext;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-end gap-2",
                    isMine ? "flex-row-reverse" : "flex-row",
                    showHeader ? "mt-3 first:mt-0" : "mt-0.5",
                  )}
                >
                  {!isMine && (
                    <div className="w-8 shrink-0">
                      {showHeader && (
                        <UserTrigger userId={c.user.id} className="!gap-0">
                          <Avatar seed={c.user.avatarSeed} url={c.user.avatarUrl} size="sm" />
                        </UserTrigger>
                      )}
                    </div>
                  )}
                  <div className={cn("flex flex-col min-w-0 max-w-[75%]", isMine ? "items-end" : "items-start")}>
                    {!isMine && showHeader && (
                      <UserTrigger userId={c.user.id} className="mb-1 px-1">
                        <strong className="text-xs text-ink-soft">{c.user.displayName}</strong>
                      </UserTrigger>
                    )}
                    <div className={cn("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2 break-words whitespace-pre-wrap text-[14px] shadow-pop-sm",
                          isMine
                            ? "bg-peach text-white rounded-br-md"
                            : "bg-white border border-cream-deep rounded-bl-md",
                        )}
                      >
                        {c.body}
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        {isMine && (
                          <button
                            onClick={() => del.mutate(c.id)}
                            className="text-ink-soft hover:text-bubblegum p-0.5"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {showTime && (
                          <span className="text-[10px] text-ink-soft whitespace-nowrap">
                            {timeAgo(c.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form
        className="flex gap-2 p-3 border-t border-cream-deep bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          className="!h-12"
        />
        <Button
          type="submit"
          disabled={!body.trim() || add.isPending}
          aria-label="보내기"
          className="!h-12 !w-12 !px-0 !rounded-xl shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </section>
  );
}

function withinMinutes(a: string, b: string, mins: number) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < mins * 60_000;
}

function ChangeRequestsSection({
  partyId, myId, isHost, pendingRequests, currentName,
}: {
  partyId: string;
  myId: string;
  isHost: boolean;
  pendingRequests: ChangeRequest[];
  currentName: string;
}) {
  const qc = useQueryClient();
  const [proposeOpen, setProposeOpen] = useState(false);

  const decide = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/parties/${partyId}/change-requests`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error("처리 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party", partyId] }),
  });

  const cancelProposal = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parties/${partyId}/change-requests?id=${id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "취소 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["party", partyId] }),
  });

  return (
    <section className="bg-white rounded-2xl shadow-pop border-2 border-white p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display font-bold text-xl">식당 변경 제안</h2>
        {!isHost && (
          <Button variant="soft" size="sm" onClick={() => setProposeOpen(true)}>
            제안하기
          </Button>
        )}
      </div>

      {proposeOpen && (
        <ChangeProposalModal
          partyId={partyId}
          currentName={currentName}
          onClose={() => setProposeOpen(false)}
        />
      )}

      {pendingRequests.length === 0 ? (
        <p className="text-sm text-ink-soft/70">대기 중인 제안이 없어요</p>
      ) : (
        <ul className="space-y-2">
          {pendingRequests.map((r) => (
            <li key={r.id} className="bg-lavender/20 rounded-xl p-3 border border-lavender/40">
              <div className="flex items-center gap-2 text-sm">
                <UserTrigger userId={r.requester.id}>
                  <Avatar seed={r.requester.avatarSeed} url={r.requester.avatarUrl} size="sm" />
                  <span><strong>{r.requester.displayName}</strong> 님이 제안</span>
                </UserTrigger>
              </div>
              <p className="mt-2 text-[15px]">
                <span className="text-ink-soft">'{currentName || "현재"}'</span> →{" "}
                <strong>'{r.newName}'</strong>
              </p>
              {r.reason && <p className="text-sm text-ink-soft mt-1 italic">"{r.reason}"</p>}
              <div className="flex gap-2 mt-3">
                {isHost && (
                  <>
                    <Button size="sm" onClick={() => decide.mutate({ id: r.id, action: "approve" })}>
                      승인
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, action: "reject" })}>
                      거절
                    </Button>
                  </>
                )}
                {r.requester.id === myId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelProposal.mutate(r.id)}
                    disabled={cancelProposal.isPending}
                  >
                    제안 취소
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function DelegateHostButton({
  partyId,
  participants,
}: {
  partyId: string;
  participants: Person[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const delegate = useMutation({
    mutationFn: async (newHostId: string) => {
      const res = await fetch(`/api/parties/${partyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostId: newHostId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "위임 실패");
    },
    onSuccess: () => {
      setOpen(false);
      setQuery("");
      qc.invalidateQueries({ queryKey: ["party", partyId] });
    },
  });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? participants.filter((p) => p.displayName.toLowerCase().includes(q))
    : participants;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-ink-soft hover:text-ink underline underline-offset-2"
      >
        위임
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
              <h2 className="font-display font-bold text-xl">파티장 위임</h2>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-5 pt-4 text-sm text-ink-soft">
              새 파티장을 선택해주세요. 위임 후엔 파티장 권한을 잃어요.
            </p>
            {participants.length > 0 && (
              <div className="px-5 pt-3">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름으로 검색"
                  className="!h-9 text-sm"
                />
              </div>
            )}
            <ul className="max-h-80 overflow-y-auto mt-2">
              {participants.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-ink-soft">
                  위임할 수 있는 참가자가 없어요
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-ink-soft">
                  &apos;{query}&apos; 와 일치하는 참가자가 없어요
                </li>
              ) : (
                filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        if (confirm(`${p.displayName} 님에게 파티장을 위임할까요?`)) {
                          delegate.mutate(p.id);
                        }
                      }}
                      disabled={delegate.isPending}
                      className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-cream-deep/60 transition disabled:opacity-50"
                    >
                      <Avatar seed={p.avatarSeed} url={p.avatarUrl} size="sm" />
                      <span className="flex-1 font-semibold text-sm">{p.displayName}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {delegate.error && (
              <p className="px-5 pb-4 text-sm text-bubblegum">{delegate.error.message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChangeProposalModal({
  partyId, currentName, onClose,
}: {
  partyId: string;
  currentName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newMapUrl, setNewMapUrl] = useState("");
  const [reason, setReason] = useState("");

  const propose = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/change-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newName: newName.trim(),
          newMapUrl: newMapUrl.trim() || undefined,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "제안 실패");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party", partyId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">식당 변경 제안</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) propose.mutate();
          }}
        >
          {currentName && (
            <p className="text-xs text-ink-soft">
              현재 식당: <strong className="text-ink">{currentName}</strong>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1 px-1">새 식당 이름</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1 px-1">네이버 지도 링크 (선택)</label>
            <Input
              value={newMapUrl}
              onChange={(e) => setNewMapUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1 px-1">제안 이유 (선택)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
          </div>

          {propose.error && <p className="text-bubblegum text-xs">{propose.error.message}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={!newName.trim() || propose.isPending}>
              {propose.isPending ? "보내는 중…" : "제안 보내기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CopyLinkButton({ partyId }: { partyId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/party/${partyId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API 거부 시 prompt 로 폴백
      window.prompt("링크 복사:", url);
    }
  }

  return (
    <button
      onClick={copy}
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 text-sm font-bold rounded-lg px-3 py-2.5 transition",
        copied
          ? "bg-mint/40 text-ink"
          : "bg-peach text-white hover:bg-peach-deep",
      )}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "복사됨!" : "링크 복사"}
    </button>
  );
}

function InviteButton({ partyId }: { partyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="초대하기"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink bg-white/70 hover:bg-white rounded-full px-2.5 sm:px-3 py-1.5 whitespace-nowrap"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">초대하기</span>
      </button>
      {open && <InviteModal partyId={partyId} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteModal({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["invitable", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/invitable`);
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ users: { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null }[] }>;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "초대 실패");
    },
    onSuccess: () => {
      setSent(true);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setTimeout(onClose, 1200);
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">초대하기</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-cream-deep">
          <CopyLinkButton partyId={partyId} />
          <p className="text-[11px] text-ink-soft/80 mt-1.5 leading-snug">
            회원이 아닌 사람도 링크로 접속해서 이름만 적고 참가할 수 있어요
          </p>
        </div>
        <div className="px-5 py-2 border-b border-cream-deep">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름으로 검색"
            className="!h-9 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-10 text-center text-ink-soft text-sm">불러오는 중…</p>
          ) : (() => {
            const q = query.trim().toLowerCase();
            const filtered = q
              ? (data?.users ?? []).filter((u) => u.displayName.toLowerCase().includes(q))
              : (data?.users ?? []);
            if ((data?.users ?? []).length === 0) {
              return <p className="p-10 text-center text-ink-soft text-sm">초대할 수 있는 사람이 없어요</p>;
            }
            if (filtered.length === 0) {
              return <p className="p-10 text-center text-ink-soft text-sm">&apos;{query}&apos; 와 일치하는 사람이 없어요</p>;
            }
            return (
              <ul className="divide-y divide-cream-deep">
                {filtered.map((u) => {
                  const on = selected.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => toggle(u.id)}
                        className={cn(
                          "w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-cream/60 transition",
                          on && "bg-sky/30",
                        )}
                      >
                        <Avatar seed={u.avatarSeed} url={u.avatarUrl} size="sm" />
                        <span className="flex-1 font-semibold text-sm">{u.displayName}</span>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center",
                            on ? "bg-peach-deep border-peach-deep text-white" : "border-ink/20",
                          )}
                        >
                          {on && "✓"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
        <div className="px-5 py-3 border-t border-cream-deep flex items-center justify-between gap-2">
          <span className="text-sm text-ink-soft">
            {sent ? "초대를 보냈어요!" : `${selected.size}명 선택`}
          </span>
          <Button
            onClick={() => send.mutate()}
            disabled={selected.size === 0 || send.isPending || sent}
            size="sm"
          >
            {send.isPending ? "보내는 중…" : sent ? "완료" : "초대 보내기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
