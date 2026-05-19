import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

/** 회사 전체가 등록한 외식 식당 이름 + 가장 최근 map_url. 자동완성용. */
export async function GET() {
  try { await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  // 최근 등록 순으로 가져와서 이름별로 dedupe (첫번째 = 가장 최근 map_url 사용)
  const parties = await prisma.party.findMany({
    where: {
      kind: "eatout",
      restaurantName: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { restaurantName: true, mapUrl: true },
    take: 500,
  });

  const seen = new Set<string>();
  const items: { name: string; mapUrl: string | null }[] = [];
  for (const p of parties) {
    const name = p.restaurantName?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    items.push({ name, mapUrl: p.mapUrl ?? null });
  }
  // 이름 알파벳/가나다 순 정렬
  items.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({ items });
}
