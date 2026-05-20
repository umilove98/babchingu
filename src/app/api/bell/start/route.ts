import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { BELL_KINDS, TIMINGS, pushPayloadFor } from "@/lib/bell";

const schema = z.object({
  kind: z.enum(BELL_KINDS),
  timing: z.enum(TIMINGS),
  targetIds: z.array(z.string()).min(1).max(50),
});

/** 기습 모임 시작 — kind 별 전 조직 동시 1개. 대상자에게 푸시. */
export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  // 같은 kind 의 활성 벨이 있으면 거부
  const existing = await prisma.coffeeBell.findFirst({
    where: { kind: parsed.data.kind, endedAt: null },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 진행 중인 모임이 있어요" }, { status: 409 });
  }

  const targetIds = [...new Set(parsed.data.targetIds.filter((id) => id !== me.id))];
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "대상자를 1명 이상 선택해 주세요" }, { status: 400 });
  }

  const bell = await prisma.coffeeBell.create({
    data: {
      initiatorId: me.id,
      kind: parsed.data.kind,
      timing: parsed.data.timing,
      targets: {
        create: targetIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  const payload = pushPayloadFor(parsed.data.kind, me.displayName, parsed.data.timing);
  await sendPushToUsers(targetIds, {
    title: payload.title,
    body: payload.body,
    url: "/",
    tag: `bell-${bell.id}`,
  });

  return NextResponse.json({ ok: true, id: bell.id });
}
