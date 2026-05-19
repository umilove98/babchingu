import { redirect } from "next/navigation";
import { getMeOrRedirect } from "@/lib/auth";
import { AdminPanel } from "./AdminPanel";

export default async function AdminPage() {
  const me = await getMeOrRedirect();
  if (!me.isAdmin) redirect("/");
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">🛠 사용자 관리</h1>
        <p className="text-ink-soft text-sm mt-1">
          계정을 발급하고 외식 등록 권한을 부여할 수 있어요.
        </p>
      </header>
      <AdminPanel myId={me.id} />
    </div>
  );
}
