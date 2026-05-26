"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const change = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "변경 실패");
    },
    onSuccess: () => {
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(onClose, 1200);
    },
  });

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 &&
    next.length >= 6 &&
    confirm.length > 0 &&
    next === confirm &&
    !change.isPending;

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">비밀번호 변경</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) change.mutate();
          }}
        >
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1 px-1">현재 비밀번호</label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1 px-1">새 비밀번호 (6자 이상)</label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-soft block mb-1 px-1">새 비밀번호 확인</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={mismatch}
            />
            {mismatch && (
              <p className="text-bubblegum text-[11px] mt-1 px-1">새 비밀번호가 일치하지 않아요</p>
            )}
          </div>
          {change.error && (
            <p className="text-bubblegum text-xs">{change.error.message}</p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={change.isPending}>
              취소
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className={cn(done && "!bg-mint/60 !text-ink")}
            >
              {change.isPending ? "변경 중…" : done ? "변경됨!" : "변경"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
