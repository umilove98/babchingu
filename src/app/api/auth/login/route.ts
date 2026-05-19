import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

const schema = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "아이디·비밀번호를 확인해 주세요" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const user = await prisma.profile.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 달라요" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 달라요" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.displayName = user.displayName;
  session.canHost = user.canHost;
  session.isAdmin = user.isAdmin;
  await session.save();

  return NextResponse.json({ ok: true });
}
