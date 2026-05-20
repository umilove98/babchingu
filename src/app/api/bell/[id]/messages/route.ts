import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

const postSchema = z.object({ body: z.string().min(1).max(500) });

async function canAccess(coffeeBellId: string, userId: string) {
  const bell = await prisma.coffeeBell.findUnique({
    where: { id: coffeeBellId },
    select: { initiatorId: true, endedAt: true },
  });
  if (!bell) return { ok: false, status: 404, error: "NOT_FOUND", bell: null };
  if (bell.initiatorId === userId) return { ok: true, bell };
  const target = await prisma.coffeeBellTarget.findUnique({
    where: { coffeeBellId_userId: { coffeeBellId, userId } },
    select: { userId: true },
  });
  if (!target) return { ok: false, status: 403, error: "FORBIDDEN", bell: null };
  return { ok: true, bell };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: coffeeBellId } = await ctx.params;
  const access = await canAccess(coffeeBellId, me.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const rows = await prisma.coffeeBellMessage.findMany({
    where: { coffeeBellId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } },
    },
  });
  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: coffeeBellId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const access = await canAccess(coffeeBellId, me.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.bell?.endedAt) {
    return NextResponse.json({ error: "이미 종료된 모임이에요" }, { status: 400 });
  }

  const m = await prisma.coffeeBellMessage.create({
    data: { coffeeBellId, userId: me.id, body: parsed.data.body },
  });
  return NextResponse.json({ ok: true, id: m.id });
}
