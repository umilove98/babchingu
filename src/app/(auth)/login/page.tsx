import Image from "next/image";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { FoodConfetti } from "@/components/FoodConfetti";

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect("/");
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 relative">
      <FoodConfetti />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 select-none">
          <div className="inline-block animate-bob">
            <Image
              src="/img/bobchingu.png"
              alt="밥친구 캐릭터"
              width={200}
              height={200}
              priority
              className="drop-shadow-[0_8px_0_rgba(74,74,107,0.08)]"
            />
          </div>
          <h1 className="font-display font-bold text-5xl mt-3 text-ink tracking-tight">
            밥친구
          </h1>
          <p className="mt-2 text-ink-soft text-sm">
            오늘 점심, 누구랑 먹지?
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-ink-soft/80 mt-6">
          계정은 관리자에게 문의해 주세요 ✿
        </p>
      </div>
    </div>
  );
}
