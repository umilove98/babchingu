"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check, Heart, LogOut, Pencil, Settings, ThumbsDown, Trophy, UtensilsCrossed, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ProfileModal } from "@/components/ProfileModal";
import { cn } from "@/lib/utils";

type ProfileData = {
  id: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl: string | null;
  isMe: boolean;
  stats: {
    eatoutHost: number;
    eatoutJoin: number;
    dosirakJoin: number;
    comment: number;
  };
  favoriteMenus: string;
  dislikedMenus: string;
};

type Achievement = {
  key: string;
  label: string;
  desc: string;
  unlocked: boolean;
};

function buildAchievements(stats: ProfileData["stats"]): Achievement[] {
  return [
    { key: "first-eatout", label: "첫 외식", desc: "외식 파티에 처음 참가", unlocked: stats.eatoutJoin >= 1 },
    { key: "first-host", label: "첫 파티장", desc: "외식 파티를 처음 주최", unlocked: stats.eatoutHost >= 1 },
    { key: "dosirak-3", label: "도시락 단골", desc: "도시락 3회", unlocked: stats.dosirakJoin >= 3 },
    { key: "dosirak-10", label: "도시락 마스터", desc: "도시락 10회", unlocked: stats.dosirakJoin >= 10 },
    { key: "eatout-5", label: "외식 즐김러", desc: "외식 5회 참가", unlocked: stats.eatoutJoin >= 5 },
    { key: "host-5", label: "베스트리더 후보", desc: "외식 5회 주최", unlocked: stats.eatoutHost >= 5 },
    { key: "chatter-10", label: "수다쟁이", desc: "댓글 10개", unlocked: stats.comment >= 10 },
    { key: "chatter-50", label: "토론왕", desc: "댓글 50개", unlocked: stats.comment >= 50 },
  ];
}

export function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<ProfileData>;
    },
  });

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-pop-lg border-2 border-white w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-deep">
          <h2 className="font-display font-bold text-xl">프로필</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink p-1" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {isLoading || !data ? (
            <p className="text-center py-12 text-ink-soft text-sm">불러오는 중…</p>
          ) : (
            <ProfileBody data={data} />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function ProfileBody({ data }: { data: ProfileData }) {
  const achievements = useMemo(() => buildAchievements(data.stats), [data.stats]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col items-center gap-3">
        <Avatar seed={data.avatarSeed} url={data.avatarUrl} size="lg" className="!w-24 !h-24" />
        <h3 className="font-display font-bold text-2xl">{data.displayName}</h3>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="외식 주최" value={data.stats.eatoutHost} accent="lavender" />
        <StatTile label="외식 참가" value={data.stats.eatoutJoin} accent="sky" />
        <StatTile label="도시락" value={data.stats.dosirakJoin} accent="mint" />
        <StatTile label="댓글" value={data.stats.comment} accent="butter" />
      </div>

      {/* 업적 */}
      <section>
        <header className="flex items-center justify-between mb-2 px-1">
          <h4 className="font-display font-bold text-sm inline-flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-peach" /> 업적
          </h4>
          <span className="text-[11px] text-ink-soft">{unlockedCount}/{achievements.length}</span>
        </header>
        <ul className="grid grid-cols-2 gap-1.5">
          {achievements.map((a) => (
            <li
              key={a.key}
              className={cn(
                "rounded-xl px-2.5 py-2 border text-[11px] leading-tight",
                a.unlocked
                  ? "bg-butter/60 border-butter-deep text-ink"
                  : "bg-cream-deep/40 border-cream-deep text-ink-soft/60",
              )}
              title={a.desc}
            >
              <div className="font-bold inline-flex items-center gap-1">
                {a.unlocked ? <Check className="w-3 h-3 text-peach-deep" /> : null}
                {a.label}
              </div>
              <div className="text-[10px] mt-0.5 opacity-80">{a.desc}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* 메뉴 태그 */}
      <MenuSection
        title="좋아하는 메뉴"
        icon={<Heart className="w-4 h-4 text-bubblegum" />}
        kind="favorite"
        initial={data.favoriteMenus}
        editable={data.isMe}
        emptyText={data.isMe ? "좋아하는 메뉴를 추가해보세요" : "아직 적어두지 않았어요"}
      />
      <MenuSection
        title="싫어하는 메뉴"
        icon={<ThumbsDown className="w-4 h-4 text-ink-soft" />}
        kind="disliked"
        initial={data.dislikedMenus}
        editable={data.isMe}
        emptyText={data.isMe ? "싫어하는 메뉴를 추가해보세요" : "아직 적어두지 않았어요"}
      />

      {data.isMe && <SelfActions data={data} />}
    </div>
  );
}

function SelfActions({ data }: { data: ProfileData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="border-t border-cream-deep pt-4 flex gap-2 justify-between">
        <button
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink bg-cream-deep hover:bg-butter rounded-full px-3.5 py-2 transition"
        >
          <Settings className="w-4 h-4" /> 프로필 설정
        </button>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-bubblegum hover:bg-bubblegum/10 rounded-full px-3.5 py-2 transition"
        >
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>
      {editOpen && (
        <ProfileModal
          me={{
            id: data.id,
            displayName: data.displayName,
            avatarSeed: data.avatarSeed,
            avatarUrl: data.avatarUrl,
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

const accentMap = {
  lavender: "bg-lavender/30 border-lavender",
  sky: "bg-sky/30 border-sky",
  mint: "bg-mint/40 border-mint",
  butter: "bg-butter/60 border-butter-deep",
} as const;

function StatTile({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent: keyof typeof accentMap;
}) {
  return (
    <div className={cn("rounded-xl border-2 px-3 py-2.5 flex items-center justify-between", accentMap[accent])}>
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <span className="font-display font-bold text-xl text-ink">{value}</span>
    </div>
  );
}

function parseTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function MenuSection({
  title, icon, kind, initial, editable, emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  kind: "favorite" | "disliked";
  initial: string;
  editable: boolean;
  emptyText: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);

  const save = useMutation({
    mutationFn: async () => {
      const field = kind === "favorite" ? "favoriteMenus" : "dislikedMenus";
      const res = await fetch("/api/me/menus", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: draft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "저장 실패");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      setEditing(false);
    },
  });

  const tags = parseTags(initial);

  return (
    <section>
      <header className="flex items-center justify-between mb-2 px-1">
        <h4 className="font-display font-bold text-sm inline-flex items-center gap-1.5">
          {icon} {title}
        </h4>
        {editable && !editing && (
          <button
            onClick={() => {
              setDraft(initial);
              setEditing(true);
            }}
            className="text-[11px] font-semibold text-ink-soft hover:text-ink inline-flex items-center gap-0.5"
          >
            <Pencil className="w-3 h-3" /> 편집
          </button>
        )}
      </header>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="쉼표로 구분 — 예: 김치찌개, 떡볶이, 라멘"
            rows={2}
            className="w-full text-sm rounded-xl border border-cream-deep bg-cream/40 px-3 py-2 focus:outline-none focus:border-peach"
          />
          <p className="text-[10px] text-ink-soft/80 px-1">최대 10개, 각 20자 이내</p>
          {save.error && <p className="text-bubblegum text-xs">{save.error.message}</p>}
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(initial);
                setEditing(false);
              }}
              disabled={save.isPending}
            >
              취소
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      ) : tags.length === 0 ? (
        <p className="text-xs text-ink-soft/70 px-1 py-2 inline-flex items-center gap-1.5">
          <UtensilsCrossed className="w-3.5 h-3.5" /> {emptyText}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li
              key={t}
              className={cn(
                "text-xs font-semibold rounded-full px-2.5 py-1",
                kind === "favorite"
                  ? "bg-bubblegum/15 text-bubblegum border border-bubblegum/30"
                  : "bg-ink/5 text-ink-soft border border-ink/10",
              )}
            >
              #{t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
