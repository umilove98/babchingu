import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { isHoliday } from "@/lib/holidays";
import { isPast, toKstDateString } from "@/lib/date";

const schema = z.object({
  partyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  restaurantName: z.string().min(1).max(80),
  mapUrl: z.string().url().max(500).nullable().optional(),
});

/** 외식 파티 1건 등록 — 권한자(can_host)만. 휴일·과거 날짜 차단. */
export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  if (!me.canHost) {
    return NextResponse.json({ error: "외식 등록 권한이 없어요" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  if (isPast(parsed.data.partyDate) && parsed.data.partyDate !== toKstDateString(new Date())) {
    return NextResponse.json({ error: "지난 날짜에는 등록할 수 없어요" }, { status: 400 });
  }
  if (await isHoliday(parsed.data.partyDate)) {
    return NextResponse.json({ error: "휴일에는 등록할 수 없어요" }, { status: 400 });
  }

  const party = await prisma.party.create({
    data: {
      partyDate: parsed.data.partyDate,
      kind: "eatout",
      restaurantName: parsed.data.restaurantName.trim(),
      mapUrl: parsed.data.mapUrl?.trim() || null,
      hostId: me.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: party.id });
}
