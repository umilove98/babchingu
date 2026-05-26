"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { UserProfileModal } from "@/components/UserProfileModal";

type Ctx = {
  openProfile: (userId: string) => void;
};

const ProfileViewerContext = createContext<Ctx | null>(null);

export function ProfileViewerProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  const openProfile = useCallback((id: string) => {
    setUserId(id);
  }, []);

  const value = useMemo<Ctx>(() => ({ openProfile }), [openProfile]);

  return (
    <ProfileViewerContext.Provider value={value}>
      {children}
      {userId && (
        <UserProfileModal userId={userId} onClose={() => setUserId(null)} />
      )}
    </ProfileViewerContext.Provider>
  );
}

/** 마운트되지 않은 곳(로그인 페이지 등)에서 호출되면 no-op. */
export function useProfileViewer(): Ctx {
  const ctx = useContext(ProfileViewerContext);
  return ctx ?? { openProfile: () => {} };
}
