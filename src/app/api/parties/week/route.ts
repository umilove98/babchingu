import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { daysFrom, dosirakIdFor, mondayOfIsoWeek, currentIsoWeek } from "@/lib/date";

export async function GET(req: Request) {
  try { await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? currentIsoWeek();
  let monday: string;
  try { monday = mondayOfIsoWeek(week); }
  catch { return NextResponse.json({ error: "BAD_WEEK" }, { status: 400 }); }

  const days = daysFrom(monday, 5);

  const parties = await prisma.party.findMany({
    where: { partyDate: { in: days } },
    include: {
      host: { select: { id: true, displayName: true, avatarSeed: true } },
      participations: {
        include: { user: { select: { id: true, displayName: true, avatarSeed: true } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, typeof parties>();
  for (const p of parties) {
    if (!byDay.has(p.partyDate)) byDay.set(p.partyDate, []);
    byDay.get(p.partyDate)!.push(p);
  }

  const result = days.map((date) => {
    const list = byDay.get(date) ?? [];
    const dos = list.find((p) => p.kind === "dosirak");
    const eatouts = list.filter((p) => p.kind === "eatout");
    return {
      date,
      dosirak: {
        id: dos?.id ?? null,
        participants: dos?.participations.map((p) => p.user) ?? [],
        commentCount: dos?._count.comments ?? 0,
        // 미생성 상태에서도 클릭 가능하도록 결정적 id 도 함께 노출
        proposedId: dosirakIdFor(date),
      },
      eatouts: eatouts.map((p) => ({
        id: p.id,
        restaurantName: p.restaurantName ?? "",
        mapUrl: p.mapUrl ?? "",
        host: p.host,
        participants: p.participations.map((x) => x.user),
        commentCount: p._count.comments,
      })),
    };
  });

  return NextResponse.json({ week, monday, days: result });
}
