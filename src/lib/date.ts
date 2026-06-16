// KST 기준 날짜 처리. 모든 partyDate 는 'YYYY-MM-DD' 문자열로 저장.

const KST_OFFSET_MIN = 9 * 60;

/** Date 객체 → KST 'YYYY-MM-DD'. */
export function toKstDateString(d: Date = new Date()): string {
  // getTime() 은 서버 타임존과 무관하게 항상 UTC epoch(ms). KST offset 만 더하면 됨.
  const kstMs = d.getTime() + KST_OFFSET_MIN * 60_000;
  const k = new Date(kstMs);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, "0");
  const day = String(k.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' 의 ISO 주차(월~일 기준 ISO-8601) → 'YYYY-Wxx'. */
export function isoWeekFromDateString(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // ISO week: Thursday-based
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 'YYYY-Wxx' → 그 주의 월요일 'YYYY-MM-DD' (KST 기준 단순 계산). */
export function mondayOfIsoWeek(isoWeek: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) throw new Error(`Invalid ISO week: ${isoWeek}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO 8601: week 1 contains Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const y = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(target.getUTCDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** monday 'YYYY-MM-DD' 부터 N일치 'YYYY-MM-DD' 배열. */
export function daysFrom(monday: string, n = 5): string[] {
  const [y, m, d] = monday.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

/** 'YYYY-MM-DD' 가 오늘인지 (KST). */
export function isToday(s: string): boolean {
  return s === toKstDateString(new Date());
}

/** 'YYYY-MM-DD' 가 오늘 이전인지 (KST). 사전적 비교만으로 정확 (YYYY-MM-DD 포맷 특성). */
export function isPast(s: string): boolean {
  return s < toKstDateString(new Date());
}

/** 'YYYY-MM-DD' → 'M월 D일 (요일)'. */
export function formatKoreanDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][dt.getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

/** 현재 KST 의 ISO 주차. */
export function currentIsoWeek(): string {
  return isoWeekFromDateString(toKstDateString());
}

/** ISO 주차 +N. */
export function shiftIsoWeek(isoWeek: string, delta: number): string {
  const monday = mondayOfIsoWeek(isoWeek);
  const [y, m, d] = monday.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta * 7));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return isoWeekFromDateString(`${yy}-${mm}-${dd}`);
}

export function dosirakIdFor(dateStr: string) {
  return `dos_${dateStr}`;
}
