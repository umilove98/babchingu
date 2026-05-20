import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

const schema = z.object({ available: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: coffeeBellId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const bell = await prisma.coffeeBell.findUnique({
    where: { id: coffeeBellId },
    select: { endedAt: true },
  });
  if (!bell) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (bell.endedAt) {
    return NextResponse.json({ error: "이미 종료된 모임이에요" }, { status: 400 });
  }

  const updated = await prisma.coffeeBellTarget.updateMany({
    where: { coffeeBellId, userId: me.id },
    data: { available: parsed.data.available, respondedAt: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "초대받지 않은 모임이에요" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
