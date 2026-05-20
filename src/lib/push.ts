// Web Push 발송 — VAPID 기반 표준 프로토콜.
// 서버 전용. notify.ts 에서 in-app Notification 생성 직후 호출.

import webpush from "web-push";
import { prisma } from "./db";

let configured = false;

function configureOnce() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@babchingu.local";
  if (!publicKey || !privateKey) {
    // 키 미설정 시 sendPushToUsers 가 silently noop 하도록 둠 (in-app 알림은 계속 동작).
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** 여러 사용자에게 동일 페이로드 발송. dead subscription 은 자동 정리. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  configureOnce();
  if (!configured) return; // VAPID 미설정 환경에서는 조용히 스킵

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        // 410 Gone / 404 Not Found = 구독이 더 이상 유효하지 않음
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          deadIds.push(s.id);
        } else {
          console.warn("[push] send failed", err?.statusCode, s.endpoint);
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } });
  }
}
