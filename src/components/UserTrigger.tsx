"use client";

import { cn } from "@/lib/utils";
import { useProfileViewer } from "@/components/ProfileViewer";

/** 아바타/이름 등 사용자 식별 영역을 감싸 클릭하면 프로필 모달을 연다. */
export function UserTrigger({
  userId,
  children,
  className,
  title,
  stopPropagation = true,
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  stopPropagation?: boolean;
}) {
  const { openProfile } = useProfileViewer();
  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) {
          e.stopPropagation();
          e.preventDefault();
        }
        openProfile(userId);
      }}
      title={title ?? "프로필 보기"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-left hover:opacity-80 transition focus:outline-none focus:ring-2 focus:ring-peach/40",
        className,
      )}
    >
      {children}
    </button>
  );
}
