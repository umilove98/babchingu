"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Cigarette, Coffee, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { type BellKind, KIND_LABEL, TIMINGS } from "@/lib/bell";

type User = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };

const TIMING_OPTIONS = [
  { value: "now" as const, label: "지금" },
  { value: "5min" as const, label: "5분 뒤" },
  { value: "10min" as const, label: "10분 뒤" },
  { value: "30min" as const, label: "30분 뒤" },
  { value: "1hour" as const, label: "1시간 뒤" },
];

export function BellTrigger({ kind }: { kind: BellKind }) {
  const [open, setOpen] = useState(false);
  const Icon = kind === "coffee" ? Coffee : Cigarette;
  const label = `${KIND_LABEL[kind]} 벨`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-cream-deep transition"
        aria-label={label}
        title={`기습 ${KIND_LABEL[kind]} 모임`}
      >
        <Icon className="w-5 h-5 text-ink" strokeWidth={2.4} />
      </button>
      {open && <StartBellModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function StartBellModal({ kind, onClose }: { kind: BellKind; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [timing, setTiming] = useState<(typeof TIMINGS)[number]>("now");
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<{ users: User[] }>;
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bell/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, timing, targetIds: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "시작 실패");
    },
    onSuccess: onClose,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const Icon = kind === "coffee" ? Coffee : Cigarette;
  const verb = kind === "coffee" ? "커피 한 잔" : "흡연 한 대";

  const content = (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl inline-flex items-center gap-2">
            <Icon className="w-5 h-5" /> 기습 {verb}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-cream-deep">
          <p className="text-xs font-semibold text-ink-soft mb-2">언제</p>
          <div className="flex flex-wrap gap-1.5">
            {TIMING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTiming(opt.value)}
                className={cn(
                  "text-xs font-bold rounded-full px-3 py-1.5 transition",
                  timing === opt.value
                    ? "bg-peach text-white"
                    : "bg-cream-deep text-ink hover:bg-butter",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-3 pb-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-soft shrink-0">
            누구랑 ({selected.size})
          </span>
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
              return <p className="p-10 text-center text-ink-soft text-sm">선택할 사람이 없어요</p>;
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
                          "w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-cream/60 transition",
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

        {start.error && (
          <p className="px-5 py-2 text-sm text-bubblegum">{start.error.message}</p>
        )}

        <div className="px-5 py-3 border-t border-cream-deep flex items-center justify-between gap-2">
          <span className="text-sm text-ink-soft">
            {selected.size}/{data?.users.length ?? 0}
          </span>
          <Button
            onClick={() => start.mutate()}
            disabled={selected.size === 0 || start.isPending}
            size="sm"
          >
            {start.isPending ? "보내는 중…" : `${KIND_LABEL[kind]} 벨 울리기`}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
