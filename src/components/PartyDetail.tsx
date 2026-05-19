"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { formatKoreanDate } from "@/lib/date";

type Me = { id: string; displayName: string; avatarSeed: string; canHost: boolean };
type Person = { id: string; displayName: string; avatarSeed: string };
type Comment = { id: string; body: string; createdAt: string; user: Person };
type ChangeRequest = {
  id: string;
  newName: string;
  newMapUrl: string | null;
  reason: string | null;
  requester: Person;
  createdAt: string;
};
type Party = {
  id: string;
  partyDate: string;
  kind: "dosirak" | "eatout";
  restaurantName: string | null;
  mapUrl: string | null;
  host: Person | null;
  participants: Person[];
  comments: Comment[];
  pendingRequests: ChangeRequest[];
};

export function PartyDetail({ me, partyId }: { me: Me; partyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["party", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<Party>;
    },
  });

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
          "rounded-2xl p-6 border-2 shadow-pop",
          data.kind === "dosirak" ? "bg-mint/50 border-mint" : "bg-butter/60 border-butter",
        )}
      >
        <p className="text-sm text-ink-soft font-medium mb-1">{formatKoreanDate(data.partyDate)}</p>
        <h1 className="font-display font-bold text-3xl flex items-center gap-3">
          <Image
            src={data.kind === "dosirak" ? "/img/dosirak.png" : "/img/sikdang.png"}
            alt=""
            width={56}
            height={56}
          />
          <span>{data.kind === "dosirak" ? "도시락" : (data.restaurantName ?? "외식")}</span>
        </h1>
        {data.kind === "eatout" && data.host && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            <Avatar seed={data.host.avatarSeed} size="sm" />
            <span className="text-ink-soft">파티장 <strong className="text-ink">{data.host.displayName}</strong></span>
          </div>
        )}
        {data.mapUrl && (
          <a
            href={data.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            <MapPin className="w-4 h-4" /> 네이버 지도 열기 <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-1.5">함께 가요 ({data.participants.length}명)</p>
            <div className="flex flex-wrap gap-2">
              {data.participants.length === 0 ? (
                <span className="text-sm text-ink-soft/70">아직 아무도 없어요. 첫 주자가 되어보세요!</span>
              ) : (
                data.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-white/70 pl-1 pr-3 py-1 rounded-full">
                    <Avatar seed={p.avatarSeed} size="sm" />
                    <span className="text-xs font-semibold">{p.displayName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <Button
            variant={joined ? "outline" : "primary"}
            onClick={() => (joined ? leave.mutate() : join.mutate())}
            disabled={join.isPending || leave.isPending}
          >
            {joined ? "참가 취소" : "나도 갈게요 ✋"}
          </Button>
        </div>
      </header>

      {data.kind === "eatout" && (
        <ChangeRequestsSection
          partyId={partyId}
          myId={me.id}
          isHost={isHost}
          isParticipant={joined}
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
      <div className="inline-block animate-bob">
        <Image src="/img/dosirak.png" alt="" width={160} height={160} priority />
      </div>
      <div>
        <h1 className="font-display font-bold text-3xl">
          {date ? formatKoreanDate(date) : ""} 도시락
        </h1>
        <p className="text-ink-soft mt-2 text-sm">아직 참가자가 없어요. 첫 주자가 되어보세요!</p>
      </div>
      <Button size="lg" onClick={onCreate}>
        🍙 첫 참가자 되기
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

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("댓글 실패");
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

  return (
    <section className="bg-white rounded-2xl shadow-pop border-2 border-white p-5">
      <h2 className="font-display font-bold text-xl mb-4">💬 한마디</h2>
      <ul className="space-y-3 mb-4">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-soft/70 text-center py-6">아직 댓글이 없어요</p>
        ) : (
          comments.map((c) => (
            <li key={c.id} className="flex gap-2.5 items-start">
              <Avatar seed={c.user.avatarSeed} size="sm" />
              <div className="flex-1 bg-cream/60 rounded-xl px-3.5 py-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{c.user.displayName}</strong>
                  <span className="text-[11px] text-ink-soft">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[14px] mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {c.user.id === me.id && (
                <button
                  onClick={() => del.mutate(c.id)}
                  className="text-ink-soft hover:text-bubblegum p-1"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Input
          placeholder="한마디 남기기"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
        />
        <Button type="submit" disabled={!body.trim() || add.isPending}>
          올리기
        </Button>
      </form>
    </section>
  );
}

function ChangeRequestsSection({
  partyId, myId, isHost, isParticipant, pendingRequests, currentName,
}: {
  partyId: string;
  myId: string;
  isHost: boolean;
  isParticipant: boolean;
  pendingRequests: ChangeRequest[];
  currentName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMapUrl, setNewMapUrl] = useState("");
  const [reason, setReason] = useState("");

  const propose = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/change-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newName, newMapUrl: newMapUrl || undefined, reason: reason || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "제안 실패");
      }
    },
    onSuccess: () => {
      setOpen(false); setNewName(""); setNewMapUrl(""); setReason("");
      qc.invalidateQueries({ queryKey: ["party", partyId] });
    },
  });

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

  if (pendingRequests.length === 0 && !isParticipant) return null;

  return (
    <section className="bg-white rounded-2xl shadow-pop border-2 border-white p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display font-bold text-xl">🔁 식당 변경 제안</h2>
        {isParticipant && !isHost && (
          <Button variant="soft" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "닫기" : "제안하기"}
          </Button>
        )}
      </div>

      {open && (
        <form
          className="space-y-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) propose.mutate();
          }}
        >
          <Input
            placeholder="새 식당 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            placeholder="네이버 지도 링크 (선택)"
            value={newMapUrl}
            onChange={(e) => setNewMapUrl(e.target.value)}
          />
          <Input
            placeholder="제안 이유 (선택)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" disabled={!newName.trim() || propose.isPending}>
            제안 보내기 ✉️
          </Button>
          {propose.error && <p className="text-bubblegum text-xs">{propose.error.message}</p>}
        </form>
      )}

      {pendingRequests.length === 0 ? (
        <p className="text-sm text-ink-soft/70">대기 중인 제안이 없어요</p>
      ) : (
        <ul className="space-y-2">
          {pendingRequests.map((r) => (
            <li key={r.id} className="bg-lavender/20 rounded-xl p-3 border border-lavender/40">
              <div className="flex items-center gap-2 text-sm">
                <Avatar seed={r.requester.avatarSeed} size="sm" />
                <span><strong>{r.requester.displayName}</strong> 님이 제안</span>
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
                      승인 ✓
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
