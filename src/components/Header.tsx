"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { CoffeeBellOverlay } from "@/components/CoffeeBellOverlay";
import { CoffeeBellTrigger } from "@/components/CoffeeBellTrigger";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileModal } from "@/components/ProfileModal";

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
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

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

          <CoffeeBellTrigger />
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-cream-deep transition"
              title="프로필"
            >
              <Avatar seed={me.avatarSeed} url={me.avatarUrl} size="sm" />
              <span className="text-sm font-semibold hidden sm:inline">
                {me.displayName}
              </span>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-40 bg-white rounded-xl shadow-pop-lg border-2 border-white overflow-hidden w-44 animate-pop-in">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileOpen(true);
                    }}
                    className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream/60"
                  >
                    프로필 편집
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream/60 border-t border-cream-deep"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
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

      {profileOpen && <ProfileModal me={me} onClose={() => setProfileOpen(false)} />}
      <CoffeeBellOverlay me={{ id: me.id }} />
    </header>
  );
}
