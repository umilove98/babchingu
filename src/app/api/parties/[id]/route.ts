import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, displayName: true, avatarSeed: true } },
      participations: {
        include: { user: { select: { id: true, displayName: true, avatarSeed: true } } },
        orderBy: { joinedAt: "asc" },
      },
      comments: {
        include: { user: { select: { id: true, displayName: true, avatarSeed: true } } },
        orderBy: { createdAt: "asc" },
      },
      changeRequests: {
        where: { status: "pending" },
        include: { requester: { select: { id: true, displayName: true, avatarSeed: true } } },
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
    comments: party.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
    })),
    pendingRequests: party.changeRequests.map((r) => ({
      id: r.id,
      newName: r.newName,
      newMapUrl: r.newMapUrl,
      reason: r.reason,
      requester: r.requester,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
