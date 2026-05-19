import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return u ? new URL(u).hostname : null;
  } catch { return null; }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // DiceBear 아바타
      { protocol: "https", hostname: "api.dicebear.com" },
      // Supabase Storage (NEXT_PUBLIC_SUPABASE_URL 의 호스트)
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost }]
        : []),
    ],
  },
};

export default nextConfig;
