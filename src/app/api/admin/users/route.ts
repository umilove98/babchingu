import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET() {
  try { await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const users = await prisma.profile.findMany({
    orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, username: true, displayName: true, avatarSeed: true, avatarUrl: true,
      canHost: true, isAdmin: true, createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

const createSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "영문/숫자/._- 만"),
  displayName: z.string().min(1).max(20),
  password: z.string().min(4).max(100).optional(),
  canHost: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

export async function POST(req: Request) {
  try { await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }
  const d = parsed.data;
  const exists = await prisma.profile.findUnique({ where: { username: d.username } });
  if (exists) return NextResponse.json({ error: "이미 사용 중인 아이디예요" }, { status: 409 });

  const generated = d.password ?? nanoid(8);
  const hash = await hashPassword(generated);
  const user = await prisma.profile.create({
    data: {
      username: d.username,
      displayName: d.displayName,
      passwordHash: hash,
      avatarSeed: `${d.username}-${nanoid(4)}`,
      canHost: d.canHost ?? false,
      isAdmin: d.isAdmin ?? false,
    },
    select: { id: true, username: true, displayName: true },
  });

  return NextResponse.json({
    user,
    initialPassword: d.password ? undefined : generated,
  });
}

const patchSchema = z.object({
  id: z.string(),
  canHost: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
  newPassword: z.string().min(4).max(100).optional(),
  displayName: z.string().min(1).max(20).optional(),
});

export async function PATCH(req: Request) {
  let me;
  try { me = await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.canHost !== undefined) data.canHost = parsed.data.canHost;
  if (parsed.data.isAdmin !== undefined) {
    // 자기 자신의 isAdmin 은 끄지 못하게 (혼자 남았을 때 잠금 방지)
    if (parsed.data.id === me.id && parsed.data.isAdmin === false) {
      return NextResponse.json({ error: "자신의 관리자 권한은 해제할 수 없어요" }, { status: 400 });
    }
    data.isAdmin = parsed.data.isAdmin;
  }
  if (parsed.data.displayName) data.displayName = parsed.data.displayName;

  let newPwd: string | undefined;
  if (parsed.data.resetPassword || parsed.data.newPassword) {
    newPwd = parsed.data.newPassword ?? nanoid(8);
    data.passwordHash = await hashPassword(newPwd);
  }

  await prisma.profile.update({ where: { id: parsed.data.id }, data });
  return NextResponse.json({ ok: true, newPassword: newPwd });
}

const deleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  let me;
  try { me = await requireAdmin(); }
  catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  if (parsed.data.id === me.id) {
    return NextResponse.json({ error: "자기 자신은 삭제할 수 없어요" }, { status: 400 });
  }
  await prisma.profile.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
