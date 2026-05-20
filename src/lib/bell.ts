// 기습 모임(커피/흡연) 공용 상수 + 푸시 페이로드 빌더.

export const BELL_KINDS = ["coffee", "smoke"] as const;
export type BellKind = (typeof BELL_KINDS)[number];

export function isBellKind(v: unknown): v is BellKind {
  return v === "coffee" || v === "smoke";
}

export const TIMINGS = ["now", "5min", "10min", "30min", "1hour"] as const;
export type Timing = (typeof TIMINGS)[number];

export const TIMING_LABEL: Record<Timing, string> = {
  now: "지금",
  "5min": "5분 뒤",
  "10min": "10분 뒤",
  "30min": "30분 뒤",
  "1hour": "1시간 뒤",
};

export const KIND_LABEL: Record<BellKind, string> = {
  coffee: "커피",
  smoke: "흡연",
};

export function pushPayloadFor(kind: BellKind, initiatorName: string, timing: Timing) {
  if (kind === "coffee") {
    return {
      title: "☕ 커피 한 잔?",
      body: `${initiatorName} 님과 ${TIMING_LABEL[timing]} coffee 한 잔 어떠세요?`,
    };
  }
  return {
    title: "🚬 흡연 한 대?",
    body: `${initiatorName} 님과 ${TIMING_LABEL[timing]} 흡연 한 대 어떠세요?`,
  };
}
