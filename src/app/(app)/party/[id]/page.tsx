import { getMeOrRedirect } from "@/lib/auth";
import { PartyDetail } from "@/components/PartyDetail";

export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMeOrRedirect();
  const { id } = await params;
  return <PartyDetail me={me} partyId={id} />;
}
