// 브라우저용 Supabase 클라이언트 — Realtime 채널 구독 전용.
// anon key 만 사용 (service_role 키는 절대 클라이언트에 노출 금지 → src/lib/supabase.ts).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY 미설정 — Realtime 비활성");
    return null;
  }

  _client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return _client;
}
