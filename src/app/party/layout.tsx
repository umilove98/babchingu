import { getMe } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

// 파티 상세는 로그인·비로그인 양쪽 모두 접근 가능. (app) 그룹 밖에 있어 자동 리다이렉트 안 됨.
export default async function PartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  return (
    <Providers>
      {me && <Header me={me} />}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {children}
      </main>
    </Providers>
  );
}
