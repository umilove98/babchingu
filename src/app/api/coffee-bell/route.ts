import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";

const TIMING = ["now", "5min", "10min", "30min", "1hour"] as const;
type Timing = (typeof TIMING)[number];

const TIMING_LABEL: Record<Timing, string> = {
  now: "지금",
  "5min": "5분 뒤",
  "10min": "10분 뒤",
  "30min": "30분 뒤",
  "1hour": "1시간 뒤",
};

const postSchema = z.object({
  timing: z.enum(TIMING),
  targetIds: z.array(z.string()).min(1).max(50),
});

/** 커피 벨 시작 — 전 조직 동시 1개만. 대상자에게 푸시 발송. */
export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  // 이미 활성 벨이 있는지 확인
  const existing = await prisma.coffeeBell.findFirst({
    where: { endedAt: null },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 진행 중인 커피 모임이 있어요" }, { status: 409 });
  }

  // 자기 자신은 대상에서 제외
  const targetIds = [...new Set(parsed.data.targetIds.filter((id) => id !== me.id))];
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "대상자를 1명 이상 선택해 주세요" }, { status: 400 });
  }

  const bell = await prisma.coffeeBell.create({
    data: {
      initiatorId: me.id,
      timing: parsed.data.timing,
      targets: {
        create: targetIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  await sendPushToUsers(targetIds, {
    title: "☕ 커피 한 잔?",
    body: `${me.displayName} 님과 ${TIMING_LABEL[parsed.data.timing]} coffee 한 잔 어떠세요?`,
    url: "/",
    tag: `coffee-bell-${bell.id}`,
  });

  return NextResponse.json({ ok: true, id: bell.id });
}

/** 현재 사용자 관련 활성 커피 벨. 본인이 initiator/target 둘 다 아니면 null. */
export async function GET() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const bell = await prisma.coffeeBell.findFirst({
    where: { endedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      initiator: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } },
      targets: {
        include: {
          user: { select: { id: true, displayName: true, avatarSeed: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!bell) return NextResponse.json({ bell: null });

  const isInitiator = bell.initiatorId === me.id;
  const myTarget = bell.targets.find((t) => t.userId === me.id);
  const isTarget = !!myTarget;

  if (!isInitiator && !isTarget) {
    return NextResponse.json({ bell: null });
  }

  const availableCount = bell.targets.filter((t) => t.available).length;

  return NextResponse.json({
    bell: {
      id: bell.id,
      initiator: bell.initiator,
      timing: bell.timing,
      timingLabel: TIMING_LABEL[bell.timing as Timing] ?? bell.timing,
      createdAt: bell.createdAt.toISOString(),
      isInitiator,
      isTarget,
      available: myTarget?.available ?? null,
      counts: {
        available: availableCount,
        total: bell.targets.length,
      },
      targets: bell.targets.map((t) => ({
        id: t.user.id,
        displayName: t.user.displayName,
        avatarSeed: t.user.avatarSeed,
        avatarUrl: t.user.avatarUrl,
        available: t.available,
      })),
    },
  });
}
