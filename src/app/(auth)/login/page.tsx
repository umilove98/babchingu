import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect("/");
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 select-none">
          <h1 className="font-display font-bold text-5xl text-ink tracking-tight">
            밥친구
          </h1>
          <p className="mt-2 text-ink-soft text-sm">
            오늘 점심, 누구랑 먹지?
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-ink-soft/80 mt-6">
          계정은 관리자에게 문의해 주세요
        </p>
      </div>
    </div>
  );
}
