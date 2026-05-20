import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyChangeRequested, notifyRestaurantChanged } from "@/lib/notify";

const postSchema = z.object({
  newName: z.string().min(1).max(80),
  newMapUrl: z.string().url().max(500).optional(),
  reason: z.string().max(300).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  const party = await prisma.party.findUnique({ where: { id }, select: { kind: true, hostId: true } });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (party.kind !== "eatout") {
    return NextResponse.json({ error: "도시락은 식당 변경 제안을 받지 않아요" }, { status: 400 });
  }

  await prisma.restaurantChangeRequest.create({
    data: {
      partyId: id,
      requesterId: me.id,
      newName: parsed.data.newName,
      newMapUrl: parsed.data.newMapUrl,
      reason: parsed.data.reason,
    },
  });
  await notifyChangeRequested(id, me.id, parsed.data.newName, parsed.data.reason);
  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: partyId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const [party, request] = await Promise.all([
    prisma.party.findUnique({ where: { id: partyId } }),
    prisma.restaurantChangeRequest.findUnique({ where: { id: parsed.data.id } }),
  ]);
  if (!party || !request || request.partyId !== partyId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (party.hostId !== me.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (request.status !== "pending") return NextResponse.json({ error: "이미 처리된 제안이에요" }, { status: 400 });

  const now = new Date();
  if (parsed.data.action === "approve") {
    const before = party.restaurantName;
    await prisma.$transaction([
      prisma.party.update({
        where: { id: partyId },
        data: {
          restaurantName: request.newName,
          mapUrl: request.newMapUrl ?? party.mapUrl,
        },
      }),
      prisma.restaurantChangeRequest.update({
        where: { id: request.id },
        data: { status: "approved", resolvedAt: now },
      }),
    ]);
    await notifyRestaurantChanged(partyId, before, request.newName);
  } else {
    await prisma.restaurantChangeRequest.update({
      where: { id: request.id },
      data: { status: "rejected", resolvedAt: now },
    });
  }
  return NextResponse.json({ ok: true });
}

/** 제안자 본인이 자기 제안을 취소 (pending 상태일 때만) */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: partyId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("id");
  if (!requestId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const request = await prisma.restaurantChangeRequest.findUnique({ where: { id: requestId } });
  if (!request || request.partyId !== partyId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (request.requesterId !== me.id) {
    return NextResponse.json({ error: "본인 제안만 취소할 수 있어요" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 제안은 취소할 수 없어요" }, { status: 400 });
  }

  await prisma.restaurantChangeRequest.delete({ where: { id: requestId } });
  return NextResponse.json({ ok: true });
}
