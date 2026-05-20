import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireMe, verifyPassword } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요"),
  newPassword: z.string().min(6, "새 비밀번호는 6자 이상이어야 해요").max(72),
});

export async function PATCH(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  const row = await prisma.profile.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!row) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const ok = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "현재 비밀번호가 맞지 않아요" }, { status: 400 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.profile.update({
    where: { id: me.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
