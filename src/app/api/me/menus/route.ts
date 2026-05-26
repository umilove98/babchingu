import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";

// 콤마로 구분된 짧은 키워드. 최대 10개 × 20자. 공백·중복·"#" 접두는 normalize.
const MAX_TAGS = 10;
const MAX_LEN = 20;

function normalize(input: string): string {
  return input
    .split(",")
    .map((s) => s.trim().replace(/^#+/, "").trim())
    .filter((s) => s.length > 0 && s.length <= MAX_LEN)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, MAX_TAGS)
    .join(",");
}

const patchSchema = z.object({
  favoriteMenus: z.string().max(500).optional(),
  dislikedMenus: z.string().max(500).optional(),
}).refine(
  (v) => v.favoriteMenus !== undefined || v.dislikedMenus !== undefined,
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

  const data: Record<string, string> = {};
  if (parsed.data.favoriteMenus !== undefined) data.favoriteMenus = normalize(parsed.data.favoriteMenus);
  if (parsed.data.dislikedMenus !== undefined) data.dislikedMenus = normalize(parsed.data.dislikedMenus);

  await prisma.profile.update({ where: { id: me.id }, data });
  return NextResponse.json({ ok: true, ...data });
}
