import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMe } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { AVATAR_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const nameSchema = z.object({
  displayName: z.string().min(1).max(20),
});

/** 본인 이름 수정 (JSON) */
export async function PATCH(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  const parsed = nameSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  await prisma.profile.update({
    where: { id: me.id },
    data: { displayName: parsed.data.displayName },
  });
  const session = await getSession();
  session.displayName = parsed.data.displayName;
  await session.save();

  return NextResponse.json({ ok: true });
}

/** 본인 아바타 이미지 업로드 (multipart/form-data, field: 'avatar') — Supabase Storage 사용 */
export async function POST(req: Request) {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  const form = await req.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "이미지 파일이 필요해요" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "PNG·JPG·WEBP·GIF 만 가능해요" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "2MB 이하의 이미지만 가능해요" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png"
    : file.type === "image/jpeg" ? "jpg"
    : file.type === "image/webp" ? "webp"
    : "gif";
  const ts = Date.now();
  const objectKey = `${me.id}/${ts}.${ext}`;
  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectKey, buffer, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json({ error: `업로드 실패: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectKey);
  const avatarUrl = pub.publicUrl;

  await prisma.profile.update({
    where: { id: me.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ ok: true, avatarUrl });
}

/** 아바타 이미지 제거 (디폴트 DiceBear 로 복귀) */
export async function DELETE() {
  let me;
  try { me = await requireMe(); }
  catch { return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); }

  // 현재 avatarUrl 의 Storage 객체도 함께 삭제 (Storage 정리)
  const current = await prisma.profile.findUnique({
    where: { id: me.id },
    select: { avatarUrl: true },
  });
  if (current?.avatarUrl) {
    const supabase = getSupabaseAdmin();
    // public URL → object key 추출: /storage/v1/object/public/avatars/{key}
    const match = /\/object\/public\/[^/]+\/(.+)$/.exec(current.avatarUrl);
    if (match) {
      await supabase.storage.from(AVATAR_BUCKET).remove([match[1]]);
    }
  }

  await prisma.profile.update({
    where: { id: me.id },
    data: { avatarUrl: null },
  });
  return NextResponse.json({ ok: true });
}
