import { redirect } from "next/navigation";
import { getMeOrRedirect } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";
import { currentIsoWeek } from "@/lib/date";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const me = await getMeOrRedirect();
  if (!me.canHost) redirect("/");
  const { week } = await searchParams;
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">외식 일정 등록</h1>
        <p className="text-ink-soft text-sm mt-1">
          한 주 외식 계획을 한꺼번에 등록·수정·삭제할 수 있어요.
        </p>
      </header>
      <RegisterForm initialWeek={week ?? currentIsoWeek()} />
    </div>
  );
}
