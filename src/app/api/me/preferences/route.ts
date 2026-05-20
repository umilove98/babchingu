import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

export async function GET() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const row = await prisma.profile.findUnique({
    where: { id: me.id },
    select: {
      notifParticipants: true,
      notifComments: true,
      notifNewParties: true,
    },
  });
  return NextResponse.json(row ?? {
    notifParticipants: true,
    notifComments: true,
    notifNewParties: true,
  });
}

const patchSchema = z.object({
  notifParticipants: z.boolean().optional(),
  notifComments: z.boolean().optional(),
  notifNewParties: z.boolean().optional(),
}).refine(
  (v) => v.notifParticipants !== undefined || v.notifComments !== undefined || v.notifNewParties !== undefined,
  { message: "변경할 항목이 없어요" },
);

export async function PATCH(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "BAD_REQUEST" }, { status: 400 });
  }

  await prisma.profile.update({
    where: { id: me.id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
