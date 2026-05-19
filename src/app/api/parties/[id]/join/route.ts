import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { enforceSingleDayJoin, notifyLeft, notifyNewMember } from "@/lib/notify";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const party = await prisma.party.findUnique({ where: { id }, select: { id: true, partyDate: true } });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const existing = await prisma.participation.findUnique({
    where: { partyId_userId: { partyId: id, userId: me.id } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyJoined: true });

  // 같은 날 다른 파티에 이미 참여 중이면 자동 탈퇴 (떠남 알림 발송)
  await enforceSingleDayJoin(me.id, party.partyDate, id);

  await prisma.participation.create({
    data: { partyId: id, userId: me.id },
  });
  await notifyNewMember(id, me.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const removed = await prisma.participation.deleteMany({
    where: { partyId: id, userId: me.id },
  });
  if (removed.count > 0) await notifyLeft(id, me.id);
  return NextResponse.json({ ok: true });
}
