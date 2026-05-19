import { getMeOrRedirect } from "@/lib/auth";
import { AchievementsView } from "./AchievementsView";

export default async function AchievementsPage() {
  await getMeOrRedirect();
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">업적</h1>
        <p className="text-ink-soft text-sm mt-1">밥친구 명예의 전당</p>
      </header>
      <AchievementsView />
    </div>
  );
}
