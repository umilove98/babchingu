import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyNewMember } from "@/lib/notify";
import { dosirakIdFor } from "@/lib/date";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const { date } = parsed.data;
  const id = dosirakIdFor(date);

  // 결정적 ID + upsert 로 동시성 안전
  await prisma.party.upsert({
    where: { id },
    update: {},
    create: { id, partyDate: date, kind: "dosirak", hostId: null },
  });

  const existing = await prisma.participation.findUnique({
    where: { partyId_userId: { partyId: id, userId: me.id } },
  });
  if (existing) return NextResponse.json({ ok: true, partyId: id, alreadyJoined: true });

  await prisma.participation.create({
    data: { partyId: id, userId: me.id },
  });
  await notifyNewMember(id, me.id);

  return NextResponse.json({ ok: true, partyId: id });
}

export async function DELETE(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const id = dosirakIdFor(parsed.data.date);
  await prisma.participation.deleteMany({
    where: { partyId: id, userId: me.id },
  });
  return NextResponse.json({ ok: true });
}
