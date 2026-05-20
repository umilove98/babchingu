import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { BellKind, TIMING_LABEL, type Timing } from "@/lib/bell";

/** 현재 사용자 관련 활성 벨들을 kind 별로 반환. */
export async function GET() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const bells = await prisma.coffeeBell.findMany({
    where: {
      endedAt: null,
      OR: [
        { initiatorId: me.id },
        { targets: { some: { userId: me.id } } },
      ],
    },
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

  return NextResponse.json({
    bells: bells.map((bell) => {
      const isInitiator = bell.initiatorId === me!.id;
      const myTarget = bell.targets.find((t) => t.userId === me!.id);
      const isTarget = !!myTarget;
      const availableCount = bell.targets.filter((t) => t.available).length;
      return {
        id: bell.id,
        kind: bell.kind as BellKind,
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
      };
    }),
  });
}
