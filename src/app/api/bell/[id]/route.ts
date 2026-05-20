import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

/** 벨 종료 — 이니시에이터만. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const bell = await prisma.coffeeBell.findUnique({
    where: { id },
    select: { initiatorId: true, endedAt: true },
  });
  if (!bell) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (bell.initiatorId !== me.id) {
    return NextResponse.json({ error: "시작한 사람만 종료할 수 있어요" }, { status: 403 });
  }
  if (bell.endedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.coffeeBell.update({
    where: { id },
    data: { endedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
