// SQLite 환경에서 DB 트리거 대신 어플리케이션 레이어에서 알림 생성.
// Postgres 이전 시: db/postgres-schema.sql 의 트리거가 이 역할을 자동 수행.

import { prisma } from "./db";

type Kind = "new_member" | "new_comment" | "change_requested" | "restaurant_changed" | "invited" | "left";

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

/** 초대 직후 호출. 각 invitee 에게 invited 알림 (이미 참가했거나 본인 제외). */
export async function notifyInvited(partyId: string, inviterId: string, inviteeIds: string[]) {
  if (!inviteeIds.length) return;
  const filtered = inviteeIds.filter((id) => id !== inviterId);
  if (!filtered.length) return;

  // 이미 참가한 유저는 제외
  const existing = await prisma.participation.findMany({
    where: { partyId, userId: { in: filtered } },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((p) => p.userId));
  const targetIds = filtered.filter((id) => !existingSet.has(id));
  if (!targetIds.length) return;

  // 표시용 displayName 캐시 (recipient 가 본인 이름을 보는 형식이므로 payload 에 저장)
  const invitees = await prisma.profile.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, displayName: true },
  });

  await prisma.notification.createMany({
    data: invitees.map((u) => ({
      userId: u.id,
      kind: "invited",
      partyId,
      actorId: inviterId,
      payload: JSON.stringify({ invitee_name: u.displayName }),
    })),
  });
}

/** 떠남 알림: 참가자가 파티에서 나가면 호스트에게 통지. host=null(도시락) 또는 host=본인일 땐 noop. */
export async function notifyLeft(partyId: string, leaverId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { hostId: true },
  });
  if (!party?.hostId || party.hostId === leaverId) return;
  await prisma.notification.create({
    data: { userId: party.hostId, kind: "left", partyId, actorId: leaverId },
  });
}

/** 같은 날 다른 파티에 이미 참가 중이면 자동 탈퇴시키고 떠남 알림 발송. */
export async function enforceSingleDayJoin(
  userId: string,
  partyDate: string,
  exceptPartyId?: string,
) {
  const dupes = await prisma.participation.findMany({
    where: {
      userId,
      ...(exceptPartyId ? { partyId: { not: exceptPartyId } } : {}),
      party: { partyDate },
    },
    select: { partyId: true },
  });
  for (const p of dupes) {
    await prisma.participation.delete({
      where: { partyId_userId: { partyId: p.partyId, userId } },
    });
    await notifyLeft(p.partyId, userId);
  }
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
