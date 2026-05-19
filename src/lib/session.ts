import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  username?: string;
  displayName?: string;
  canHost?: boolean;
  isAdmin?: boolean;
};

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "SESSION_SECRET 환경변수가 32자 이상이어야 합니다. .env 를 확인하세요.",
  );
}

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "babchingu_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** 로그인 필요. 미인증이면 throw → 호출부에서 redirect 처리. */
export async function requireSession() {
  const s = await getSession();
  if (!s.userId) throw new Error("UNAUTHENTICATED");
  return s as Required<SessionData>;
}
