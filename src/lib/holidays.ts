// 한국 법정공휴일 + 사내 등록 휴일.
// 법정공휴일은 static, 사내 휴일은 CustomHoliday 테이블에서 조회.
// 서버 사이드 전용 (Prisma 사용).

import { prisma } from "./db";

const STATIC_HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "삼일절 대체",
  "2025-05-05": "어린이날·부처님오신날",
  "2025-05-06": "대체공휴일",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "대체공휴일",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절",

  // 2026
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "삼일절 대체",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-09-28": "대체공휴일",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",

  // 2027
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일",
  "2027-03-01": "삼일절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-06-07": "대체공휴일",
  "2027-08-15": "광복절",
  "2027-08-16": "광복절 대체",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "개천절 대체",
  "2027-10-09": "한글날",
  "2027-10-11": "한글날 대체",
  "2027-12-25": "성탄절",
};

function staticHolidayOf(dateStr: string): string | null {
  return STATIC_HOLIDAYS[dateStr] ?? null;
}

/** 단일 날짜 휴일 여부·사유. static 우선, 없으면 DB 조회. */
export async function holidayOf(dateStr: string): Promise<string | null> {
  const stat = staticHolidayOf(dateStr);
  if (stat) return stat;
  const custom = await prisma.customHoliday.findUnique({ where: { date: dateStr } });
  return custom?.reason ?? null;
}

export async function isHoliday(dateStr: string): Promise<boolean> {
  return Boolean(await holidayOf(dateStr));
}

/** 여러 날짜 한 번에 조회 — 캘린더 주간 조회 등에 유용. */
export async function holidaysForDates(dates: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const needsDb: string[] = [];
  for (const d of dates) {
    const s = staticHolidayOf(d);
    if (s) result[d] = s;
    else needsDb.push(d);
  }
  if (needsDb.length) {
    const customs = await prisma.customHoliday.findMany({
      where: { date: { in: needsDb } },
    });
    for (const c of customs) result[c.date] = c.reason;
  }
  return result;
}
