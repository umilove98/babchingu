import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

/** 해당 파티에 초대 가능한 사용자 목록 — 본인·기존 참가자·호스트 제외 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: { participations: { select: { userId: true } } },
  });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const exclude = new Set<string>([me.id, ...party.participations.map((p) => p.userId)]);
  if (party.hostId) exclude.add(party.hostId);

  const users = await prisma.profile.findMany({
    where: { id: { notIn: [...exclude] } },
    orderBy: { displayName: "asc" },
    select: { id: true, username: true, displayName: true, avatarSeed: true, avatarUrl: true },
  });
  return NextResponse.json({ users });
}
