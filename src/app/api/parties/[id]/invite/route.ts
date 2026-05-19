import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyInvited } from "@/lib/notify";

const schema = z.object({
  userIds: z.array(z.string()).min(1).max(50),
});

/** 파티에 다른 사용자를 초대 — 참가자 또는 호스트만 가능 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const party = await prisma.party.findUnique({ where: { id }, select: { id: true, hostId: true } });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const myPart = await prisma.participation.findUnique({
    where: { partyId_userId: { partyId: id, userId: me.id } },
  });
  if (!myPart && party.hostId !== me.id) {
    return NextResponse.json({ error: "참가자 또는 파티장만 초대할 수 있어요" }, { status: 403 });
  }

  await notifyInvited(id, me.id, parsed.data.userIds);
  return NextResponse.json({ ok: true });
}
