import { getMeOrRedirect } from "@/lib/auth";
import { CalendarView } from "@/components/CalendarView";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ isoWeek: string }>;
}) {
  const me = await getMeOrRedirect();
  const { isoWeek } = await params;
  return <CalendarView me={me} initialWeek={isoWeek} />;
}
