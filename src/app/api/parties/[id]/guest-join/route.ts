import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isHoliday } from "@/lib/holidays";
import { isPast, toKstDateString } from "@/lib/date";
import { notifyGuestJoined, notifyGuestLeft } from "@/lib/notify";

/** 현재 토큰이 이 파티에 참가되어 있는지 조회. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: partyId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ joined: false, name: null });

  const row = await prisma.guestParticipation.findUnique({
    where: { partyId_token: { partyId, token } },
    select: { name: true },
  });
  return NextResponse.json({
    joined: row !== null,
    name: row?.name ?? null,
  });
}

const postSchema = z.object({
  name: z.string().min(1).max(20).transform((s) => s.trim()),
  token: z.string().min(8).max(128),
});

const deleteSchema = z.object({ token: z.string().min(8).max(128) });

/** 비회원(손님) 참가. 이름·토큰을 받아 GuestParticipation 생성. 이미 같은 토큰이면 noop. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: partyId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }
  if (!parsed.data.name) {
    return NextResponse.json({ error: "이름을 입력해 주세요" }, { status: 400 });
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { id: true, partyDate: true, kind: true },
  });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (isPast(party.partyDate) && party.partyDate !== toKstDateString(new Date())) {
    return NextResponse.json({ error: "지난 파티에는 참가할 수 없어요" }, { status: 400 });
  }
  if (await isHoliday(party.partyDate)) {
    return NextResponse.json({ error: "휴일에는 참가할 수 없어요" }, { status: 400 });
  }

  const existing = await prisma.guestParticipation.findUnique({
    where: { partyId_token: { partyId, token: parsed.data.token } },
  });
  if (existing) {
    // 이름만 변경 허용
    if (existing.name !== parsed.data.name) {
      await prisma.guestParticipation.update({
        where: { partyId_token: { partyId, token: parsed.data.token } },
        data: { name: parsed.data.name },
      });
    }
    return NextResponse.json({ ok: true, alreadyJoined: true });
  }

  await prisma.guestParticipation.create({
    data: { partyId, name: parsed.data.name, token: parsed.data.token },
  });
  await notifyGuestJoined(partyId, parsed.data.name);

  return NextResponse.json({ ok: true });
}

/** 비회원 참가 취소. 같은 브라우저(token 일치)만 본인 참가를 지울 수 있음. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: partyId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const existing = await prisma.guestParticipation.findUnique({
    where: { partyId_token: { partyId, token: parsed.data.token } },
    select: { name: true },
  });
  if (!existing) return NextResponse.json({ ok: true });

  await prisma.guestParticipation.delete({
    where: { partyId_token: { partyId, token: parsed.data.token } },
  });
  await notifyGuestLeft(partyId, existing.name);

  return NextResponse.json({ ok: true });
}
