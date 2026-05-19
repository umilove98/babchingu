// SQLite 환경에서 DB 트리거 대신 어플리케이션 레이어에서 알림 생성.
// Postgres 이전 시: db/postgres-schema.sql 의 트리거가 이 역할을 자동 수행.

import { prisma } from "./db";

type Kind = "new_member" | "new_comment" | "change_requested" | "restaurant_changed";

async function recipientsOfParty(partyId: string, excludeUserId?: string): Promise<string[]> {
  const [parts, party] = await Promise.all([
    prisma.participation.findMany({
      where: { partyId },
      select: { userId: true },
    }),
    prisma.party.findUnique({ where: { id: partyId }, select: { hostId: true } }),
  ]);
  const set = new Set<string>();
  for (const p of parts) set.add(p.userId);
  if (party?.hostId) set.add(party.hostId);
  if (excludeUserId) set.delete(excludeUserId);
  return [...set];
}

async function bulkInsert(
  userIds: string[],
  kind: Kind,
  partyId: string,
  actorId: string | null,
  payload?: Record<string, unknown>,
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((uid) => ({
      userId: uid, kind, partyId, actorId,
      payload: payload ? JSON.stringify(payload) : null,
    })),
  });
}

/** 참가 직후 호출. 새 참가자 자신은 제외하고 기존 멤버에게 new_member 알림. */
export async function notifyNewMember(partyId: string, newUserId: string) {
  const recipients = await recipientsOfParty(partyId, newUserId);
  await bulkInsert(recipients, "new_member", partyId, newUserId);
}

/** 댓글 작성 직후 호출. */
export async function notifyNewComment(partyId: string, commenterId: string) {
  const recipients = await recipientsOfParty(partyId, commenterId);
  await bulkInsert(recipients, "new_comment", partyId, commenterId);
}

/** 식당 변경 제안 직후 호출. 호스트에게만. */
export async function notifyChangeRequested(
  partyId: string,
  requesterId: string,
  newName: string,
  reason?: string,
) {
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { hostId: true } });
  if (!party?.hostId || party.hostId === requesterId) return;
  await bulkInsert([party.hostId], "change_requested", partyId, requesterId, {
    new_name: newName,
    reason: reason ?? null,
  });
}

/** 식당 변경(승인) 직후 호출. 참가자 + 호스트 전원에게. */
export async function notifyRestaurantChanged(
  partyId: string,
  beforeName: string | null,
  afterName: string | null,
) {
  const recipients = await recipientsOfParty(partyId);
  await bulkInsert(recipients, "restaurant_changed", partyId, null, {
    before_name: beforeName,
    after_name: afterName,
  });
}
