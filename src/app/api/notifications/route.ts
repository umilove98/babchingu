import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { formatKoreanDate } from "@/lib/date";

export async function GET() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      actor: { select: { displayName: true, avatarSeed: true, avatarUrl: true } },
      party: { select: { kind: true, partyDate: true, restaurantName: true } },
    },
  });
  const unread = await prisma.notification.count({
    where: { userId: me.id, readAt: null },
  });

  const items = rows.map((n) => ({
    id: n.id,
    kind: n.kind as
      | "new_member"
      | "new_comment"
      | "change_requested"
      | "change_approved"
      | "change_rejected"
      | "restaurant_changed"
      | "invited"
      | "left"
      | "party_created",
    partyId: n.partyId,
    actorName: n.actor?.displayName ?? null,
    actorSeed: n.actor?.avatarSeed ?? null,
    payload: n.payload ? safeJson(n.payload) : null,
    partyLabel: n.party
      ? n.party.kind === "dosirak"
        ? `${formatKoreanDate(n.party.partyDate)} 도시락`
        : `${formatKoreanDate(n.party.partyDate)} ${n.party.restaurantName ?? "외식"}`
      : null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json({ items, unread });
}

const patchSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(50) }),
  z.object({ all: z.literal(true) }),
]);

export async function PATCH(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  if ("all" in parsed.data) {
    await prisma.notification.updateMany({
      where: { userId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { id: { in: parsed.data.ids }, userId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}

function safeJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}
