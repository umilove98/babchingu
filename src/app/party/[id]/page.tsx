import { getMe } from "@/lib/auth";
import { PartyDetail } from "@/components/PartyDetail";
import { GuestPartyView } from "@/components/GuestPartyView";

export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  const { id } = await params;
  return me ? <PartyDetail me={me} partyId={id} /> : <GuestPartyView partyId={id} />;
}
