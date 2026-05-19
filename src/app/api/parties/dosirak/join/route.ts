import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { enforceSingleDayJoin, notifyLeft, notifyNewMember } from "@/lib/notify";
import { dosirakIdFor } from "@/lib/date";
import { isHoliday } from "@/lib/holidays";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const { date } = parsed.data;
  if (await isHoliday(date)) {
    return NextResponse.json({ error: "휴일에는 도시락 모임을 만들 수 없어요" }, { status: 400 });
  }
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

  // 같은 날 다른 파티에 이미 참여 중이면 자동 탈퇴 (떠남 알림 발송)
  await enforceSingleDayJoin(me.id, date, id);

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
  const removed = await prisma.participation.deleteMany({
    where: { partyId: id, userId: me.id },
  });
  if (removed.count > 0) await notifyLeft(id, me.id);
  return NextResponse.json({ ok: true });
}
