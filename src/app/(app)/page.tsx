import { getMeOrRedirect } from "@/lib/auth";
import { CalendarView } from "@/components/CalendarView";
import { currentIsoWeek } from "@/lib/date";

export default async function HomePage() {
  const me = await getMeOrRedirect();
  return <CalendarView me={me} initialWeek={currentIsoWeek()} />;
}
