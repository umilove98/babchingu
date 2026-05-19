import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";

type Person = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
type Rank = { rank: number; user: Person; count: number };

export async function GET() {
  try { await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  // 1) 베스트리더 — 외식 파티장(host) 횟수 top 3
  const leaderRows = await prisma.$queryRaw<Array<{ hostId: string; count: bigint }>>`
    SELECT "hostId" AS "hostId", COUNT(*) AS count
    FROM "Party"
    WHERE "hostId" IS NOT NULL AND kind = 'eatout'
    GROUP BY "hostId"
    ORDER BY count DESC, "hostId" ASC
    LIMIT 3
  `;

  // 2) 베스트팔로워 — 외식 참가 횟수 top 3
  const followerRows = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
    SELECT p."userId" AS "userId", COUNT(*) AS count
    FROM "Participation" p
    JOIN "Party" pa ON p."partyId" = pa.id
    WHERE pa.kind = 'eatout'
    GROUP BY p."userId"
    ORDER BY count DESC, p."userId" ASC
    LIMIT 3
  `;

  // 3) 도시락지박령 — 도시락 참가 횟수 top 3
  const dosirakRows = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
    SELECT p."userId" AS "userId", COUNT(*) AS count
    FROM "Participation" p
    JOIN "Party" pa ON p."partyId" = pa.id
    WHERE pa.kind = 'dosirak'
    GROUP BY p."userId"
    ORDER BY count DESC, p."userId" ASC
    LIMIT 3
  `;

  // 4) 최고의밥친구들 — 역대 가장 많은 사람이 참가한 파티 1건
  const topPartyRows = await prisma.$queryRaw<Array<{ id: string; count: bigint }>>`
    SELECT pa.id, COUNT(p."userId") AS count
    FROM "Party" pa
    LEFT JOIN "Participation" p ON p."partyId" = pa.id
    GROUP BY pa.id
    HAVING COUNT(p."userId") > 0
    ORDER BY count DESC, pa."createdAt" ASC
    LIMIT 1
  `;

  // 프로필 일괄 조회
  const allUserIds = [
    ...leaderRows.map((r) => r.hostId),
    ...followerRows.map((r) => r.userId),
    ...dosirakRows.map((r) => r.userId),
  ];
  const profiles = allUserIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true },
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  function toRank(rows: Array<{ userId: string; count: bigint }>): Rank[] {
    return rows.flatMap<Rank>((r, i) => {
      const u = profileMap.get(r.userId);
      if (!u) return [];
      return [{ rank: i + 1, user: u, count: Number(r.count) }];
    });
  }

  const bestLeader = toRank(leaderRows.map((r) => ({ userId: r.hostId, count: r.count })));
  const bestFollower = toRank(followerRows);
  const dosirakKing = toRank(dosirakRows);

  let bestParty:
    | {
        id: string;
        partyDate: string;
        dateLabel: string;
        kind: "dosirak" | "eatout";
        restaurantName: string | null;
        host: Person | null;
        participants: Person[];
        count: number;
      }
    | null = null;

  if (topPartyRows.length) {
    const top = topPartyRows[0];
    const party = await prisma.party.findUnique({
      where: { id: top.id },
      include: {
        host: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } },
        participations: {
          include: { user: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (party) {
      bestParty = {
        id: party.id,
        partyDate: party.partyDate,
        dateLabel: formatKoreanDate(party.partyDate),
        kind: party.kind as "dosirak" | "eatout",
        restaurantName: party.restaurantName,
        host: party.host,
        participants: party.participations.map((p) => p.user),
        count: Number(top.count),
      };
    }
  }

  return NextResponse.json({ bestLeader, bestFollower, dosirakKing, bestParty });
}
