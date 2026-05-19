import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireMe } from "@/lib/auth";

/** 사내 등록 휴일 목록 — 로그인 사용자 누구나 조회 가능 */
export async function GET() {
  try { await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const items = await prisma.customHoliday.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json({
    items: items.map((h) => ({
      date: h.date,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(60),
});

/** 휴일 등록 — 관리자만 */
export async function POST(req: Request) {
  let me;
  try { me = await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  await prisma.customHoliday.upsert({
    where: { date: parsed.data.date },
    update: { reason: parsed.data.reason, createdBy: me.id },
    create: {
      date: parsed.data.date,
      reason: parsed.data.reason,
      createdBy: me.id,
    },
  });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** 휴일 삭제 — 관리자만 */
export async function DELETE(req: Request) {
  try { await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  await prisma.customHoliday.deleteMany({ where: { date: parsed.data.date } });
  return NextResponse.json({ ok: true });
}
