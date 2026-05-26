"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { BellOverlay } from "@/components/BellOverlay";
import { BellTrigger } from "@/components/BellTrigger";
import { NotificationBell } from "@/components/NotificationBell";
import { useProfileViewer } from "@/components/ProfileViewer";

type Me = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl?: string | null;
  canHost: boolean;
  isAdmin: boolean;
};

export function Header({ me }: { me: Me }) {
  const { openProfile } = useProfileViewer();

  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur-md border-b-2 border-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <span className="font-display font-bold text-2xl tracking-tight">
            밥친구
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/achievements"
            className="px-3 py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep hidden sm:inline-block"
          >
            업적
          </Link>
          {me.isAdmin && (
            <Link
              href="/admin"
              className="px-3 py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep hidden sm:inline-block"
            >
              관리
            </Link>
          )}

          <BellTrigger kind="coffee" />
          <BellTrigger kind="smoke" />
          <NotificationBell />

          <button
            type="button"
            onClick={() => openProfile(me.id)}
            className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-cream-deep transition"
            title="내 프로필"
          >
            <Avatar seed={me.avatarSeed} url={me.avatarUrl} size="sm" />
            <span className="text-sm font-semibold hidden sm:inline">
              {me.displayName}
            </span>
          </button>
        </nav>
      </div>

      {/* 모바일 보조 네비 */}
      <div className="sm:hidden border-t border-white px-4 py-1 flex gap-1">
        <Link
          href="/achievements"
          className="flex-1 text-center py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep"
        >
          업적
        </Link>
        {me.isAdmin && (
          <Link
            href="/admin"
            className="flex-1 text-center py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep"
          >
            관리
          </Link>
        )}
      </div>

      <BellOverlay me={{ id: me.id }} />
    </header>
  );
}
