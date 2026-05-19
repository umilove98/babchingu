import { getMeOrRedirect } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMeOrRedirect();
  return (
    <Providers>
      <Header me={me} />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {children}
      </main>
    </Providers>
  );
}
