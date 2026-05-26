import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

/** 다른 사용자(또는 본인) 프로필 — 통계 + 좋아하는/싫어하는 메뉴 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;

  const user = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      avatarSeed: true,
      avatarUrl: true,
      favoriteMenus: true,
      dislikedMenus: true,
    },
  });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // 통계
  const [eatoutHostCount, eatoutJoinCount, dosirakJoinCount, commentCount] = await Promise.all([
    prisma.party.count({ where: { kind: "eatout", hostId: id } }),
    prisma.participation.count({ where: { userId: id, party: { kind: "eatout" } } }),
    prisma.participation.count({ where: { userId: id, party: { kind: "dosirak" } } }),
    prisma.comment.count({ where: { userId: id } }),
  ]);

  return NextResponse.json({
    id: user.id,
    displayName: user.displayName,
    avatarSeed: user.avatarSeed,
    avatarUrl: user.avatarUrl,
    isMe: user.id === me.id,
    stats: {
      eatoutHost: eatoutHostCount,
      eatoutJoin: eatoutJoinCount,
      dosirakJoin: dosirakJoinCount,
      comment: commentCount,
    },
    favoriteMenus: user.favoriteMenus,
    dislikedMenus: user.dislikedMenus,
  });
}
