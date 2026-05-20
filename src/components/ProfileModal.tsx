"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Lock, Trash2, Upload, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type Me = {
  id: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl?: string | null;
};

export function ProfileModal({ me, onClose }: { me: Me; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(me.displayName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(me.avatarUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portal 대상은 client 에만 존재
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const saveName = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "이름 변경 실패");
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/me", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "업로드 실패");
      return body.avatarUrl as string;
    },
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
  });

  async function handleSave() {
    setError(null);
    try {
      if (name.trim() !== me.displayName) await saveName.mutateAsync();
      const file = fileRef.current?.files?.[0];
      if (file) await upload.mutateAsync(file);
      qc.invalidateQueries();
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  async function handleRemoveAvatar() {
    setError(null);
    try {
      await removeAvatar.mutateAsync();
      setPreviewUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewUrl(URL.createObjectURL(f));
  }

  const loading = saveName.isPending || upload.isPending || removeAvatar.isPending;

  const content = (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-sm max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">프로필 편집</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="flex flex-col items-center gap-3">
            <Avatar seed={me.avatarSeed} url={previewUrl} size="lg" className="!w-24 !h-24" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink bg-cream-deep hover:bg-butter rounded-full px-3 py-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> 이미지 업로드
              </button>
              {(previewUrl || me.avatarUrl) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft bg-cream-deep hover:bg-bubblegum hover:text-white rounded-full px-3 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 기본 아바타
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFile}
              className="hidden"
            />
            <p className="text-[11px] text-ink-soft">PNG·JPG·WEBP·GIF / 2MB 이하</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5 px-1">표시 이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          </div>

          <PasswordSection />

          {error && <p className="text-bubblegum text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button
              onClick={handleSave}
              disabled={loading || !name.trim()}
            >
              {loading ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function PasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

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
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    },
  });

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 &&
    next.length >= 6 &&
    confirm.length > 0 &&
    next === confirm &&
    !change.isPending;

  return (
    <div className="border-t border-cream-deep pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink hover:text-peach"
      >
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-4 h-4" /> 비밀번호 변경
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <form
          className="mt-3 space-y-2.5"
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
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className={cn("w-full", done && "!bg-mint/60 !text-ink")}
          >
            {change.isPending ? "변경 중…" : done ? "변경됨!" : "비밀번호 변경"}
          </Button>
        </form>
      )}
    </div>
  );
}
