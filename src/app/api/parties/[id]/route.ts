import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getMe, requireMe } from "@/lib/auth";
import { isHoliday } from "@/lib/holidays";
import { notifyRestaurantChanged } from "@/lib/notify";

/** 파티 상세 — 로그인·비회원 모두 접근 가능. 비회원에겐 댓글·변경제안 숨김. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getMe();

  const { id } = await ctx.params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } },
      participations: {
        include: { user: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
      guests: {
        select: { id: true, name: true, joinedAt: true },
        orderBy: { joinedAt: "asc" },
      },
      comments: {
        include: { user: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      changeRequests: {
        where: { status: "pending" },
        include: { requester: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    id: party.id,
    partyDate: party.partyDate,
    kind: party.kind,
    restaurantName: party.restaurantName,
    mapUrl: party.mapUrl,
    host: party.host,
    participants: party.participations.map((p) => p.user),
    guests: party.guests.map((g) => ({ id: g.id, name: g.name })),
    comments: me
      ? party.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          user: c.user,
        }))
      : [],
    pendingRequests: me
      ? party.changeRequests.map((r) => ({
          id: r.id,
          newName: r.newName,
          newMapUrl: r.newMapUrl,
          reason: r.reason,
          requester: r.requester,
          createdAt: r.createdAt.toISOString(),
        }))
      : [],
  });
}

const patchSchema = z.object({
  partyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  restaurantName: z.string().min(1).max(80).optional(),
  mapUrl: z.string().url().max(500).nullable().optional(),
  hostId: z.string().optional(),
}).refine(
  (v) => v.partyDate !== undefined || v.restaurantName !== undefined || v.mapUrl !== undefined || v.hostId !== undefined,
  { message: "변경할 필드가 없어요" },
);

/** 파티 정보 부분 수정 — 호스트(또는 시스템 도시락의 경우 참가자도 차단). 위임/날짜이동/식당명·지도 변경. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // 호스트만 수정 가능. 도시락(host_id null)은 수정 불가.
  if (!party.hostId || party.hostId !== me.id) {
    return NextResponse.json({ error: "파티장만 수정할 수 있어요" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};

  if (parsed.data.partyDate !== undefined) {
    if (party.kind !== "eatout") {
      return NextResponse.json({ error: "외식 파티만 날짜 이동이 가능해요" }, { status: 400 });
    }
    if (await isHoliday(parsed.data.partyDate)) {
      return NextResponse.json({ error: "휴일에는 외식을 등록할 수 없어요" }, { status: 400 });
    }
    data.partyDate = parsed.data.partyDate;
  }
  if (parsed.data.restaurantName !== undefined) data.restaurantName = parsed.data.restaurantName;
  if (parsed.data.mapUrl !== undefined) data.mapUrl = parsed.data.mapUrl;

  // 호스트 위임: 새 host_id 가 실제로 존재하는 참가자여야 함
  if (parsed.data.hostId !== undefined && parsed.data.hostId !== party.hostId) {
    const newHostId = parsed.data.hostId;
    const targetIsParticipant = await prisma.participation.findUnique({
      where: { partyId_userId: { partyId: id, userId: newHostId } },
    });
    if (!targetIsParticipant) {
      return NextResponse.json({ error: "새 파티장은 현재 파티 참가자여야 해요" }, { status: 400 });
    }
    data.hostId = newHostId;
  }

  const before = { restaurantName: party.restaurantName, mapUrl: party.mapUrl };
  await prisma.party.update({ where: { id }, data });

  // 식당명/지도 변경 시 참가자 알림
  const nameChanged = parsed.data.restaurantName !== undefined && parsed.data.restaurantName !== before.restaurantName;
  const mapChanged = parsed.data.mapUrl !== undefined && parsed.data.mapUrl !== before.mapUrl;
  if (nameChanged || mapChanged) {
    await notifyRestaurantChanged(id, before.restaurantName, parsed.data.restaurantName ?? before.restaurantName);
  }

  return NextResponse.json({ ok: true });
}

/** 호스트가 자기 외식 파티를 삭제. 도시락(시스템 파티)은 삭제 불가. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const party = await prisma.party.findUnique({
    where: { id },
    select: { hostId: true, kind: true },
  });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (party.kind !== "eatout") {
    return NextResponse.json({ error: "도시락은 삭제할 수 없어요" }, { status: 400 });
  }
  if (!party.hostId || party.hostId !== me.id) {
    return NextResponse.json({ error: "파티장만 삭제할 수 있어요" }, { status: 403 });
  }

  // 참가자·댓글·변경제안·알림은 FK on delete cascade 로 함께 정리됨
  await prisma.party.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
