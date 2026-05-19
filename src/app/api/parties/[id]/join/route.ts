import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyNewMember } from "@/lib/notify";

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
  await prisma.participation.deleteMany({
    where: { partyId: id, userId: me.id },
  });
  return NextResponse.json({ ok: true });
}
