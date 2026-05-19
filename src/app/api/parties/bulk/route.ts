import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyRestaurantChanged } from "@/lib/notify";
import { isHoliday } from "@/lib/holidays";

const itemSchema = z.object({
  id: z.string().optional(),                  // 기존 파티 갱신
  partyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  restaurantName: z.string().min(1).max(80),
  mapUrl: z.string().url().max(500).optional().nullable(),
});

const bodySchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  items: z.array(itemSchema).max(50),
  deletedIds: z.array(z.string()).max(50).optional(),
});

/** 내가 호스트인 외식 파티 일주일치 조회 */
export async function GET(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  if (!fromDate || !toDate) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const parties = await prisma.party.findMany({
    where: {
      hostId: me.id,
      kind: "eatout",
      partyDate: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ partyDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, partyDate: true, restaurantName: true, mapUrl: true },
  });
  return NextResponse.json({ parties });
}

/** 추가/수정/삭제를 트랜잭션으로 처리 */
export async function PUT(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }
  if (!me.canHost) return NextResponse.json({ error: "외식 등록 권한이 없어요" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  const { items, deletedIds = [] } = parsed.data;

  const holidayHit = items.find((i) => isHoliday(i.partyDate));
  if (holidayHit) {
    return NextResponse.json(
      { error: `${holidayHit.partyDate} 은(는) 휴일이라 외식 일정을 등록할 수 없어요` },
      { status: 400 },
    );
  }

  // 갱신용으로 기존 파티 미리 조회 (식당명 변경 알림용)
  const updateIds = items.filter((i) => i.id).map((i) => i.id!) ;
  const existings = updateIds.length
    ? await prisma.party.findMany({ where: { id: { in: updateIds }, hostId: me.id } })
    : [];

  const beforeMap = new Map(existings.map((e) => [e.id, e]));

  const ops: Promise<unknown>[] = [];

  // 삭제: 자신이 호스트인 외식 파티만
  if (deletedIds.length) {
    ops.push(prisma.party.deleteMany({
      where: { id: { in: deletedIds }, hostId: me.id, kind: "eatout" },
    }));
  }

  // 갱신·생성
  const changeNotifications: Array<{ id: string; before: string | null; after: string }> = [];
  for (const item of items) {
    if (item.id) {
      const existing = beforeMap.get(item.id);
      if (!existing) continue;
      ops.push(prisma.party.update({
        where: { id: item.id },
        data: {
          restaurantName: item.restaurantName,
          mapUrl: item.mapUrl ?? null,
          partyDate: item.partyDate,
        },
      }));
      if (
        existing.restaurantName !== item.restaurantName
        || existing.mapUrl !== (item.mapUrl ?? null)
      ) {
        changeNotifications.push({
          id: item.id,
          before: existing.restaurantName,
          after: item.restaurantName,
        });
      }
    } else {
      ops.push(prisma.party.create({
        data: {
          partyDate: item.partyDate,
          kind: "eatout",
          restaurantName: item.restaurantName,
          mapUrl: item.mapUrl ?? null,
          hostId: me.id,
        },
      }));
    }
  }

  await prisma.$transaction(ops as never);

  // 변경 알림 (참가자가 있는 경우만 효과)
  for (const c of changeNotifications) {
    await notifyRestaurantChanged(c.id, c.before, c.after);
  }

  return NextResponse.json({ ok: true });
}
