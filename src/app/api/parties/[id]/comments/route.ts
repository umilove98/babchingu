import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { notifyNewComment } from "@/lib/notify";

const postSchema = z.object({ body: z.string().min(1).max(500) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const party = await prisma.party.findUnique({ where: { id }, select: { id: true } });
  if (!party) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const c = await prisma.comment.create({
    data: { partyId: id, userId: me.id, body: parsed.data.body },
  });
  await notifyNewComment(id, me.id);
  return NextResponse.json({ ok: true, id: c.id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const { id: partyId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("id");
  if (!commentId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c || c.partyId !== partyId) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (c.userId !== me.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
