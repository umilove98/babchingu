"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/NotificationBell";

type Me = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  canHost: boolean;
  isAdmin: boolean;
};

export function Header({ me }: { me: Me }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur-md border-b-2 border-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/img/bobchingu.png"
            alt=""
            width={44}
            height={44}
            className="group-hover:animate-wiggle"
            priority
          />
          <span className="font-display font-bold text-2xl tracking-tight">
            밥친구
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {me.canHost && (
            <Link
              href="/register"
              className="px-3 py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep hidden sm:inline-block"
            >
              ✏️ 외식 등록
            </Link>
          )}
          {me.isAdmin && (
            <Link
              href="/admin"
              className="px-3 py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep hidden sm:inline-block"
            >
              🛠 관리
            </Link>
          )}

          <NotificationBell />

          <button
            onClick={logout}
            className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-cream-deep transition"
            title="로그아웃"
          >
            <Avatar seed={me.avatarSeed} size="sm" />
            <span className="text-sm font-semibold hidden sm:inline">
              {me.displayName}
            </span>
          </button>
        </nav>
      </div>

      {/* 모바일 보조 네비 */}
      {(me.canHost || me.isAdmin) && (
        <div className="sm:hidden border-t border-white px-4 py-1 flex gap-1">
          {me.canHost && (
            <Link
              href="/register"
              className="flex-1 text-center py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep"
            >
              ✏️ 외식 등록
            </Link>
          )}
          {me.isAdmin && (
            <Link
              href="/admin"
              className="flex-1 text-center py-2 rounded-full text-sm font-semibold text-ink hover:bg-cream-deep"
            >
              🛠 관리
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
