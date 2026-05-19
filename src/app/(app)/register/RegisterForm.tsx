"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  currentIsoWeek,
  daysFrom,
  formatKoreanDate,
  mondayOfIsoWeek,
  shiftIsoWeek,
} from "@/lib/date";

type Item = {
  // 화면 키
  key: string;
  // DB 에 있던 id (수정 대상)
  id?: string;
  partyDate: string;
  restaurantName: string;
  mapUrl: string;
};

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

export function RegisterForm({ initialWeek }: { initialWeek: string }) {
  const router = useRouter();
  const [week, setWeek] = useState(initialWeek);
  const monday = mondayOfIsoWeek(week);
  const days = useMemo(() => daysFrom(monday, 5), [monday]);
  const [from, to] = [days[0], days[days.length - 1]];
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["register", week],
    queryFn: async () => {
      const res = await fetch(`/api/parties/bulk?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("불러오기 실패");
      return res.json() as Promise<{
        parties: Array<{ id: string; partyDate: string; restaurantName: string | null; mapUrl: string | null }>;
      }>;
    },
  });

  const [items, setItems] = useState<Item[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setItems(
      data.parties.map((p) => ({
        key: p.id,
        id: p.id,
        partyDate: p.partyDate,
        restaurantName: p.restaurantName ?? "",
        mapUrl: p.mapUrl ?? "",
      })),
    );
    setDeletedIds([]);
    setSaveMsg(null);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = items
        .filter((i) => i.restaurantName.trim())
        .map((i) => ({
          id: i.id,
          partyDate: i.partyDate,
          restaurantName: i.restaurantName.trim(),
          mapUrl: i.mapUrl.trim() ? i.mapUrl.trim() : null,
        }));
      const res = await fetch("/api/parties/bulk", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ week, items: cleaned, deletedIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "저장 실패");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["register", week] });
      qc.invalidateQueries({ queryKey: ["week", week] });
      setSaveMsg("저장됐어요!");
      setTimeout(() => setSaveMsg(null), 2500);
    },
  });

  const hasChanges = useMemo(() => {
    if (deletedIds.length > 0) return true;
    if (!data) return false;
    const original = new Map(data.parties.map((p) => [p.id, p]));
    for (const item of items) {
      if (!item.id) {
        // 새 행: 식당명 입력이 있을 때만 dirty
        if (item.restaurantName.trim()) return true;
        continue;
      }
      const orig = original.get(item.id);
      if (!orig) return true;
      if ((orig.restaurantName ?? "") !== item.restaurantName.trim()) return true;
      if ((orig.mapUrl ?? "") !== item.mapUrl.trim()) return true;
      if (orig.partyDate !== item.partyDate) return true;
    }
    return false;
  }, [items, deletedIds, data]);

  function addRowFor(date: string) {
    setItems((prev) => [
      ...prev,
      { key: newKey(), partyDate: date, restaurantName: "", mapUrl: "" },
    ]);
  }
  function updateRow(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeRow(key: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.id) setDeletedIds((d) => [...d, target.id!]);
      return prev.filter((i) => i.key !== key);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 justify-between flex-wrap bg-white p-3 rounded-xl shadow-pop-sm border-2 border-white">
        <div>
          <strong className="font-display text-lg">
            {formatKoreanDate(days[0])} - {formatKoreanDate(days[days.length - 1])}
          </strong>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeek(shiftIsoWeek(week, -1))}
            className="w-9 h-9 rounded-full bg-cream-deep hover:bg-butter flex items-center justify-center"
            aria-label="지난 주"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {week !== currentIsoWeek() && (
            <Button variant="soft" size="sm" onClick={() => setWeek(currentIsoWeek())}>이번 주</Button>
          )}
          <button
            onClick={() => setWeek(shiftIsoWeek(week, 1))}
            className="w-9 h-9 rounded-full bg-cream-deep hover:bg-butter flex items-center justify-center"
            aria-label="다음 주"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-10 text-ink-soft">불러오는 중…</p>
      ) : (
        <div className="space-y-3">
          {days.map((date) => {
            const dayItems = items.filter((i) => i.partyDate === date);
            return (
              <div key={date} className="bg-white rounded-2xl shadow-pop border-2 border-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-lg">{formatKoreanDate(date)}</h3>
                  <button
                    onClick={() => addRowFor(date)}
                    className="text-xs font-bold inline-flex items-center gap-1 text-peach-deep hover:text-peach-deep/80"
                  >
                    <Plus className="w-3 h-3" /> 외식 추가
                  </button>
                </div>
                {dayItems.length === 0 ? (
                  <p className="text-sm text-ink-soft/70 text-center py-3">
                    이 날은 외식 일정이 없어요
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dayItems.map((item) => (
                      <li key={item.key} className="flex gap-2 items-start">
                        <div className="flex-1 grid sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="식당 이름 (예: 시오리)"
                            value={item.restaurantName}
                            onChange={(e) => updateRow(item.key, { restaurantName: e.target.value })}
                          />
                          <Input
                            placeholder="네이버 지도 링크 (선택)"
                            value={item.mapUrl}
                            onChange={(e) => updateRow(item.key, { mapUrl: e.target.value })}
                            error={Boolean(item.mapUrl) && !isLikelyUrl(item.mapUrl)}
                          />
                        </div>
                        <button
                          onClick={() => removeRow(item.key)}
                          className="w-12 h-12 rounded-full bg-cream-deep hover:bg-bubblegum hover:text-white flex items-center justify-center transition"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between sticky bottom-4 bg-white rounded-2xl p-2 pl-5 shadow-pop-lg border-2 border-white">
        <p className={cn("text-sm font-semibold", saveMsg ? "text-peach-deep" : "text-ink-soft")}>
          {saveMsg ?? (save.error?.message ? save.error.message : hasChanges ? "변경사항이 있어요" : "변경사항 없음")}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" onClick={() => router.push("/")}>
            돌아가기
          </Button>
          {hasChanges && (
            <Button onClick={() => save.mutate()} disabled={save.isPending} size="md">
              {save.isPending ? "저장 중…" : "저장하기"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function isLikelyUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}
