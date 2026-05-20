"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { ExternalLink, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { formatKoreanDate } from "@/lib/date";

type Person = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
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
};

const TOKEN_KEY = "babchingu_guest_token";

function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = nanoid(24);
    window.localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function GuestPartyView({ partyId }: { partyId: string }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string>("");
  const [name, setName] = useState("");

  // 클라이언트 mount 후 token 확보 (SSR-safe — localStorage 접근은 client only)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(getOrCreateToken());
  }, []);

  const { data: party, isLoading } = useQuery({
    queryKey: ["guest-party", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<Party>;
    },
  });

  const { data: myStatus } = useQuery({
    queryKey: ["guest-status", partyId, token],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/guest-join?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ joined: boolean; name: string | null }>;
    },
    enabled: token.length > 0,
  });

  const join = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/guest-join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "참가 실패");
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["guest-party", partyId] });
      qc.invalidateQueries({ queryKey: ["guest-status", partyId, token] });
    },
  });

  const leave = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/parties/${partyId}/guest-join`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("취소 실패");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest-party", partyId] });
      qc.invalidateQueries({ queryKey: ["guest-status", partyId, token] });
    },
  });

  if (isLoading) return <p className="text-center py-20 text-ink-soft">불러오는 중…</p>;
  if (!party) return <p className="text-center py-20 text-ink-soft">파티를 찾을 수 없어요</p>;

  const joined = myStatus?.joined ?? false;
  const myName = myStatus?.name ?? null;
  const totalCount = party.participants.length + party.guests.length;
  const canJoin = name.trim().length > 0 && name.trim().length <= 20;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <header
        className={cn(
          "rounded-2xl p-6 border-2 shadow-pop",
          party.kind === "dosirak" ? "bg-mint/50 border-mint" : "bg-butter/60 border-butter",
        )}
      >
        <p className="text-sm text-ink-soft font-medium mb-1">{formatKoreanDate(party.partyDate)}</p>
        <h1 className="font-display font-bold text-3xl">
          {party.kind === "dosirak" ? "도시락" : (party.restaurantName ?? "외식")}
        </h1>
        {party.kind === "eatout" && party.host && (
          <p className="text-sm text-ink-soft mt-2">
            파티장 <strong className="text-ink">{party.host.displayName}</strong>
          </p>
        )}
        {party.mapUrl && (
          <a
            href={party.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold text-ink-soft hover:text-ink"
          >
            <MapPin className="w-5 h-5" /> 위치보기 <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <div className="mt-5">
          <p className="text-xs font-semibold text-ink-soft mb-1.5">함께 가요 ({totalCount}명)</p>
          <div className="flex flex-wrap gap-2">
            {totalCount === 0 ? (
              <span className="text-sm text-ink-soft/70">아직 아무도 없어요</span>
            ) : (
              <>
                {party.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-white/70 pl-1 pr-3 py-1 rounded-full">
                    <Avatar seed={p.avatarSeed} url={p.avatarUrl} size="sm" />
                    <span className="text-xs font-semibold">{p.displayName}</span>
                  </div>
                ))}
                {party.guests.map((g) => (
                  <div key={g.id} className="flex items-center gap-1.5 bg-white/60 pl-2.5 pr-3 py-1 rounded-full border border-dashed border-ink/15">
                    <span className="text-xs font-semibold text-ink-soft">손님</span>
                    <span className="text-xs font-semibold">{g.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow-pop border-2 border-white p-5">
        {joined ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">{myName}</strong> 님으로 참가했어요
            </p>
            <Button
              variant="outline"
              onClick={() => leave.mutate()}
              disabled={leave.isPending}
              className="w-full"
            >
              {leave.isPending ? "취소 중…" : "참가 취소"}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canJoin) join.mutate();
            }}
          >
            <div>
              <label className="text-xs font-semibold text-ink-soft mb-1.5 block">
                이름
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력해 주세요"
                maxLength={20}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={!canJoin || join.isPending || !token}
              className="w-full"
            >
              {join.isPending ? "참가 중…" : "참가하기"}
            </Button>
            {join.error && (
              <p className="text-bubblegum text-xs">{join.error.message}</p>
            )}
          </form>
        )}
        <p className="text-[11px] text-ink-soft/80 mt-4 leading-snug">
          ※ 참가 취소는 이 브라우저에서만 가능해요. 다른 브라우저로 접속하면 다시 참가해야 해요.
        </p>
      </section>
    </div>
  );
}
