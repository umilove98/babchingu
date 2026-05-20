import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

/** 본인 제외 전체 사용자 목록 — 커피 벨 대상자 선택 등에 사용. */
export async function GET() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const users = await prisma.profile.findMany({
    where: { id: { not: me.id } },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      avatarSeed: true,
      avatarUrl: true,
    },
  });
  return NextResponse.json({ users });
}
