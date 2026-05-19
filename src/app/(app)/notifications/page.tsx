import { getMeOrRedirect } from "@/lib/auth";
import { NotificationsList } from "./NotificationsList";

export default async function NotificationsPage() {
  await getMeOrRedirect();
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">🔔 알림</h1>
        <p className="text-ink-soft text-sm mt-1">최근 20개의 알림을 볼 수 있어요.</p>
      </header>
      <NotificationsList />
    </div>
  );
}
