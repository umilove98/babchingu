"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cigarette, Coffee, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import { type BellKind, KIND_LABEL } from "@/lib/bell";

type Target = {
  id: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl?: string | null;
  available: boolean;
};

type ActiveBell = {
  id: string;
  kind: BellKind;
  initiator: { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
  timing: string;
  timingLabel: string;
  createdAt: string;
  isInitiator: boolean;
  isTarget: boolean;
  available: boolean | null;
  counts: { available: number; total: number };
  targets: Target[];
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
};

type Me = { id: string };

export function BellOverlay({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; bellId: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const { data } = useQuery({
    queryKey: ["bells-active"],
    queryFn: async () => {
      const res = await fetch("/api/bell/active");
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ bells: ActiveBell[] }>;
    },
    refetchInterval: 15000,
  });

  const bells = useMemo(() => data?.bells ?? [], [data]);
  const openBell = bells.find((b) => b.id === openId) ?? null;

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel("bells-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "CoffeeBell" },
        () => qc.invalidateQueries({ queryKey: ["bells-active"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "CoffeeBellTarget" },
        () => qc.invalidateQueries({ queryKey: ["bells-active"] }),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [qc]);

  const end = useMutation({
    mutationFn: async (bellId: string) => {
      const res = await fetch(`/api/bell/${bellId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("종료 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bells-active"] }),
  });

  // 현재 열려있는 채팅의 벨이 사라지면 닫기
  useEffect(() => {
    if (openId && !bells.some((b) => b.id === openId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenId(null);
    }
    if (ctxMenu && !bells.some((b) => b.id === ctxMenu.bellId)) {
      setCtxMenu(null);
    }
  }, [bells, openId, ctxMenu]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  if (!mounted || bells.length === 0) return null;

  const overlay = (
    <>
      {/* 우측 중앙에 활성 벨 수만큼 sticky 버튼 세로 스택 */}
      <div className="fixed z-40 right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {bells.map((bell) => {
          const Icon = bell.kind === "coffee" ? Coffee : Cigarette;
          return (
            <button
              key={bell.id}
              onClick={() => setOpenId(bell.id)}
              onContextMenu={(e) => {
                if (!bell.isInitiator) return;
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, bellId: bell.id });
              }}
              className={cn(
                "w-16 h-16 rounded-full bg-peach text-white shadow-pop-lg",
                "flex flex-col items-center justify-center gap-0.5",
                "hover:bg-peach-deep hover:scale-105 transition-all animate-pulse-soft",
              )}
              title={bell.isInitiator ? "클릭: 채팅 · 우클릭: 종료" : `${KIND_LABEL[bell.kind]} 채팅 열기`}
              aria-label={`${KIND_LABEL[bell.kind]} 모임`}
            >
              <Icon className="w-5 h-5" strokeWidth={2.4} />
              <span className="text-[11px] font-bold">
                {bell.counts.available}/{bell.counts.total}
              </span>
            </button>
          );
        })}
      </div>

      {ctxMenu && (
        <div
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 60 }}
          className="bg-white rounded-lg shadow-pop-lg border border-ink/10 py-1 min-w-[140px] animate-pop-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const bellId = ctxMenu.bellId;
              setCtxMenu(null);
              if (confirm("모임을 종료할까요?")) end.mutate(bellId);
            }}
            className="w-full text-left px-3 py-2 text-sm font-semibold text-bubblegum hover:bg-cream/60"
          >
            모임 종료
          </button>
        </div>
      )}

      {openBell && (
        <BellChat
          bell={openBell}
          me={me}
          onClose={() => setOpenId(null)}
          onEnd={() => end.mutate(openBell.id)}
        />
      )}
    </>
  );

  return createPortal(overlay, document.body);
}

function BellChat({
  bell, me, onClose, onEnd,
}: {
  bell: ActiveBell;
  me: Me;
  onClose: () => void;
  onEnd: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["bell-messages", bell.id],
    queryFn: async () => {
      const res = await fetch(`/api/bell/${bell.id}/messages`);
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ messages: Message[] }>;
    },
    refetchInterval: 10000,
  });
  const messages = data?.messages ?? [];

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel(`bell-${bell.id}-msg`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "CoffeeBellMessage",
          filter: `coffeeBellId=eq.${bell.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["bell-messages", bell.id] }),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [bell.id, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bell/${bell.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) throw new Error("전송 실패");
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["bell-messages", bell.id] });
    },
  });

  const toggleAvailable = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bell/${bell.id}/respond`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ available: !bell.available }),
      });
      if (!res.ok) throw new Error("응답 실패");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bells-active"] }),
  });

  const Icon = bell.kind === "coffee" ? Coffee : Cigarette;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-cream-deep flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-peach shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-lg leading-tight truncate">
              {bell.initiator.displayName} 님의 {KIND_LABEL[bell.kind]}
            </h2>
            <p className="text-[11px] text-ink-soft">
              {bell.timingLabel} · 가능 {bell.counts.available}/{bell.counts.total}
            </p>
          </div>
          {bell.isTarget && (
            <button
              onClick={() => toggleAvailable.mutate()}
              disabled={toggleAvailable.isPending}
              className={cn(
                "text-xs font-bold rounded-lg px-3 py-1.5 transition disabled:opacity-50 shrink-0",
                bell.available
                  ? "bg-mint text-ink"
                  : "bg-peach text-white hover:bg-peach-deep",
              )}
            >
              {bell.available ? "✓ 가능" : "가능"}
            </button>
          )}
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="bg-cream-deep/40 px-4 py-4 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-ink-soft/70 text-center py-8">
              아직 메시지가 없어요
            </p>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => {
                const isMine = m.user.id === me.id;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex items-end gap-2",
                      isMine ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    {!isMine && (
                      <Avatar seed={m.user.avatarSeed} url={m.user.avatarUrl} size="sm" />
                    )}
                    <div className={cn("flex flex-col min-w-0 max-w-[75%]", isMine ? "items-end" : "items-start")}>
                      {!isMine && (
                        <strong className="text-[11px] text-ink-soft mb-0.5 px-1">{m.user.displayName}</strong>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-1.5 break-words whitespace-pre-wrap text-[14px] shadow-pop-sm",
                          isMine
                            ? "bg-peach text-white rounded-br-md"
                            : "bg-white border border-cream-deep rounded-bl-md",
                        )}
                      >
                        {m.body}
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
            if (body.trim()) send.mutate();
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
            disabled={!body.trim() || send.isPending}
            aria-label="보내기"
            className="!h-12 !w-12 !px-0 !rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {bell.isInitiator && (
          <button
            onClick={() => {
              if (confirm("모임을 종료할까요?")) {
                onEnd();
                onClose();
              }
            }}
            className="px-5 py-2.5 text-xs font-bold text-bubblegum hover:bg-cream/40 border-t border-cream-deep"
          >
            모임 종료
          </button>
        )}
      </div>
    </div>
  );
}
