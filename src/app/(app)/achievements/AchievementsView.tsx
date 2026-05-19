"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type Person = { id: string; displayName: string; avatarSeed: string; avatarUrl?: string | null };
type Rank = { rank: number; user: Person; count: number };
type BestParty = {
  id: string;
  partyDate: string;
  dateLabel: string;
  kind: "dosirak" | "eatout";
  restaurantName: string | null;
  host: Person | null;
  participants: Person[];
  count: number;
};

type AchievementsData = {
  bestLeader: Rank[];
  bestFollower: Rank[];
  dosirakKing: Rank[];
  bestParty: BestParty | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function AchievementsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/api/achievements");
      if (!res.ok) throw new Error("로드 실패");
      return res.json() as Promise<AchievementsData>;
    },
  });

  if (isLoading) return <p className="text-center py-20 text-ink-soft">불러오는 중…</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <RankCard
        title="베스트리더"
        subtitle="파티장을 가장 많이 한 사람"
        unit="회"
        accent="lavender"
        ranks={data?.bestLeader ?? []}
      />
      <RankCard
        title="베스트팔로워"
        subtitle="외식 파티에 가장 많이 참가한 사람"
        unit="회"
        accent="sky"
        ranks={data?.bestFollower ?? []}
      />
      <RankCard
        title="도시락지박령"
        subtitle="도시락을 가장 많이 먹은 사람"
        unit="회"
        accent="mint"
        ranks={data?.dosirakKing ?? []}
      />
      <BestPartyCard party={data?.bestParty ?? null} />
    </div>
  );
}

const accentMap = {
  lavender: { bg: "bg-lavender/30", border: "border-lavender", chip: "bg-lavender/60" },
  sky: { bg: "bg-sky/30", border: "border-sky", chip: "bg-sky/60" },
  mint: { bg: "bg-mint/40", border: "border-mint", chip: "bg-mint/70" },
  bubblegum: { bg: "bg-bubblegum/20", border: "border-bubblegum", chip: "bg-bubblegum/50" },
} as const;

function RankCard({
  title, subtitle, unit, accent, ranks,
}: {
  title: string;
  subtitle: string;
  unit: string;
  accent: keyof typeof accentMap;
  ranks: Rank[];
}) {
  const a = accentMap[accent];
  return (
    <section className={cn("rounded-2xl p-5 border-2 shadow-pop", a.bg, a.border)}>
      <header className="mb-4">
        <h2 className="font-display font-bold text-2xl">{title}</h2>
        <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>
      </header>
      {ranks.length === 0 ? (
        <p className="text-sm text-ink-soft/80 py-4 text-center">아직 기록이 없어요</p>
      ) : (
        <ul className="space-y-2">
          {ranks.map((r) => (
            <li key={r.user.id} className="flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2">
              <span className="text-xl w-6 text-center" aria-hidden>
                {MEDALS[r.rank - 1] ?? r.rank}
              </span>
              <Avatar seed={r.user.avatarSeed} url={r.user.avatarUrl} size="sm" />
              <span className="flex-1 font-bold text-sm">{r.user.displayName}</span>
              <span className={cn("text-xs font-bold text-ink rounded-full px-2.5 py-0.5", a.chip)}>
                {r.count}{unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BestPartyCard({ party }: { party: BestParty | null }) {
  const a = accentMap.bubblegum;
  return (
    <section className={cn("rounded-2xl p-5 border-2 shadow-pop sm:col-span-2", a.bg, a.border)}>
      <header className="mb-4">
        <h2 className="font-display font-bold text-2xl">최고의 밥친구들</h2>
        <p className="text-xs text-ink-soft mt-0.5">역대 가장 많은 사람이 참가한 파티</p>
      </header>
      {!party ? (
        <p className="text-sm text-ink-soft/80 py-4 text-center">아직 기록이 없어요</p>
      ) : (
        <Link
          href={`/party/${party.id}`}
          className="block bg-white/80 hover:bg-white rounded-xl px-4 py-3 transition"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="text-xs text-ink-soft">{party.dateLabel}</p>
              <p className="font-display font-bold text-xl">
                {party.kind === "dosirak" ? "도시락" : (party.restaurantName ?? "외식")}
              </p>
            </div>
            <span className={cn("text-sm font-bold text-ink rounded-full px-3 py-1", a.chip)}>
              {party.count}명 참가
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {party.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-cream/80 pl-1 pr-3 py-1 rounded-full">
                <Avatar seed={p.avatarSeed} url={p.avatarUrl} size="sm" />
                <span className="text-xs font-semibold">{p.displayName}</span>
              </div>
            ))}
          </div>
        </Link>
      )}
    </section>
  );
}
