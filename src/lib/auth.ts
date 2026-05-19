import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { getSession } from "./session";
import { redirect } from "next/navigation";

const ROUNDS = 10;

export function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** 서버 컴포넌트/Route Handler 에서 호출. 미인증 시 /login 으로 리다이렉트. */
export async function getMeOrRedirect() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const me = await prisma.profile.findUnique({
    where: { id: session.userId },
    select: {
      id: true, username: true, displayName: true, avatarSeed: true,
      canHost: true, isAdmin: true,
    },
  });
  if (!me) {
    await session.destroy();
    redirect("/login");
  }
  return me;
}

/** 옵셔널 — 로그인 안 했어도 null 반환. */
export async function getMe() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.profile.findUnique({
    where: { id: session.userId },
    select: {
      id: true, username: true, displayName: true, avatarSeed: true,
      canHost: true, isAdmin: true,
    },
  });
}

/** API Route 에서 사용. 미인증이면 throw, 호출부에서 401 응답. */
export async function requireMe() {
  const session = await getSession();
  if (!session.userId) {
    const err = new Error("UNAUTHENTICATED");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  const me = await prisma.profile.findUnique({
    where: { id: session.userId },
    select: {
      id: true, username: true, displayName: true, avatarSeed: true,
      canHost: true, isAdmin: true,
    },
  });
  if (!me) {
    const err = new Error("UNAUTHENTICATED");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return me;
}

export async function requireAdmin() {
  const me = await requireMe();
  if (!me.isAdmin) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return me;
}
