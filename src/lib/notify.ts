// SQLite 환경에서 DB 트리거 대신 어플리케이션 레이어에서 알림 생성.
// Postgres 이전 시: db/postgres-schema.sql 의 트리거가 이 역할을 자동 수행.
//
// 각 함수는 (1) in-app Notification 레코드 생성, (2) 사용자별 환경설정 필터링,
// (3) Web Push 전송을 함께 처리한다.

import { prisma } from "./db";
import { formatKoreanDate } from "./date";
import { sendPushToUsers, type PushPayload } from "./push";

type Kind =
  | "new_member"
  | "new_comment"
  | "change_requested"
  | "change_approved"
  | "change_rejected"
  | "restaurant_changed"
  | "invited"
  | "left"
  | "party_created";

type PartyLite = { partyDate: string; kind: string; restaurantName: string | null };

function partyLabel(p: PartyLite | null | undefined): string {
  if (!p) return "파티";
  const date = formatKoreanDate(p.partyDate);
  return p.kind === "dosirak" ? `${date} 도시락` : `${date} ${p.restaurantName ?? "외식"}`;
}

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

/** 환경설정 필터링 — true 인 사용자만 통과. */
async function filterByPref(
  userIds: string[],
  field: "notifParticipants" | "notifComments" | "notifNewParties",
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.profile.findMany({
    where: { id: { in: userIds }, [field]: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function bulkInsert(
  userIds: string[],
  kind: Kind,
  partyId: string | null,
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
  const raw = await recipientsOfParty(partyId, newUserId);
  const recipients = await filterByPref(raw, "notifParticipants");
  await bulkInsert(recipients, "new_member", partyId, newUserId);

  const [party, actor] = await Promise.all([
    prisma.party.findUnique({
      where: { id: partyId },
      select: { partyDate: true, kind: true, restaurantName: true },
    }),
    prisma.profile.findUnique({ where: { id: newUserId }, select: { displayName: true } }),
  ]);
  await sendPushToUsers(recipients, {
    title: `${actor?.displayName ?? "누군가"} 님이 합류했어요`,
    body: partyLabel(party),
    url: `/party/${partyId}`,
    tag: `new_member-${partyId}`,
  });
}

/** 댓글 작성 직후 호출. */
export async function notifyNewComment(partyId: string, commenterId: string) {
  const raw = await recipientsOfParty(partyId, commenterId);
  const recipients = await filterByPref(raw, "notifComments");
  await bulkInsert(recipients, "new_comment", partyId, commenterId);

  const [party, actor] = await Promise.all([
    prisma.party.findUnique({
      where: { id: partyId },
      select: { partyDate: true, kind: true, restaurantName: true },
    }),
    prisma.profile.findUnique({ where: { id: commenterId }, select: { displayName: true } }),
  ]);
  await sendPushToUsers(recipients, {
    title: `${actor?.displayName ?? "누군가"} 님이 댓글을 남겼어요`,
    body: partyLabel(party),
    url: `/party/${partyId}`,
    tag: `new_comment-${partyId}`,
  });
}

/** 식당 변경 제안 직후 호출. 호스트에게만. (고정 ON) */
export async function notifyChangeRequested(
  partyId: string,
  requesterId: string,
  newName: string,
  reason?: string,
) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { hostId: true, partyDate: true, kind: true, restaurantName: true },
  });
  if (!party?.hostId || party.hostId === requesterId) return;
  await bulkInsert([party.hostId], "change_requested", partyId, requesterId, {
    new_name: newName,
    reason: reason ?? null,
  });
  const actor = await prisma.profile.findUnique({
    where: { id: requesterId },
    select: { displayName: true },
  });
  await sendPushToUsers([party.hostId], {
    title: "식당 변경 제안",
    body: `${actor?.displayName ?? "누군가"} 님이 '${newName}' 제안 — ${partyLabel(party)}`,
    url: `/party/${partyId}`,
    tag: `change_requested-${partyId}`,
  });
}

/** 변경 제안 승인됨 — 제안자에게. (고정 ON) */
export async function notifyChangeApproved(
  partyId: string,
  requesterId: string,
  newName: string,
) {
  await bulkInsert([requesterId], "change_approved", partyId, null, { new_name: newName });
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { partyDate: true, kind: true, restaurantName: true },
  });
  await sendPushToUsers([requesterId], {
    title: "변경 제안이 승인됐어요",
    body: `'${newName}' 으로 결정 — ${partyLabel(party)}`,
    url: `/party/${partyId}`,
    tag: `change_approved-${partyId}`,
  });
}

/** 변경 제안 거절됨 — 제안자에게. (고정 ON) */
export async function notifyChangeRejected(
  partyId: string,
  requesterId: string,
  newName: string,
) {
  await bulkInsert([requesterId], "change_rejected", partyId, null, { new_name: newName });
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { partyDate: true, kind: true, restaurantName: true },
  });
  await sendPushToUsers([requesterId], {
    title: "변경 제안이 거절됐어요",
    body: `'${newName}' 제안 — ${partyLabel(party)}`,
    url: `/party/${partyId}`,
    tag: `change_rejected-${partyId}`,
  });
}

/** 초대 직후 호출. 각 invitee 에게 invited 알림 (이미 참가했거나 본인 제외). (고정 ON) */
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

  const [invitees, party, inviter] = await Promise.all([
    prisma.profile.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, displayName: true },
    }),
    prisma.party.findUnique({
      where: { id: partyId },
      select: { partyDate: true, kind: true, restaurantName: true },
    }),
    prisma.profile.findUnique({ where: { id: inviterId }, select: { displayName: true } }),
  ]);

  await prisma.notification.createMany({
    data: invitees.map((u) => ({
      userId: u.id,
      kind: "invited",
      partyId,
      actorId: inviterId,
      payload: JSON.stringify({ invitee_name: u.displayName }),
    })),
  });

  await sendPushToUsers(targetIds, {
    title: `${inviter?.displayName ?? "누군가"} 님이 초대했어요!`,
    body: partyLabel(party),
    url: `/party/${partyId}`,
    tag: `invited-${partyId}`,
  });
}

/** 떠남 알림: 참가자가 파티에서 나가면 호스트에게 통지. host=null(도시락) 또는 host=본인일 땐 noop. */
export async function notifyLeft(partyId: string, leaverId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { hostId: true, partyDate: true, kind: true, restaurantName: true },
  });
  if (!party?.hostId || party.hostId === leaverId) return;

  const filtered = await filterByPref([party.hostId], "notifParticipants");
  if (filtered.length === 0) return;

  await prisma.notification.create({
    data: { userId: party.hostId, kind: "left", partyId, actorId: leaverId },
  });
  const leaver = await prisma.profile.findUnique({
    where: { id: leaverId },
    select: { displayName: true },
  });
  await sendPushToUsers(filtered, {
    title: `${leaver?.displayName ?? "누군가"} 님이 떠났어요`,
    body: partyLabel(party),
    url: `/party/${partyId}`,
    tag: `left-${partyId}`,
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

/** 식당 변경(승인 또는 호스트 직접 수정) 직후 호출. 참가자 + 호스트 전원에게. (고정 ON) */
export async function notifyRestaurantChanged(
  partyId: string,
  beforeName: string | null,
  afterName: string | null,
  excludeUserId?: string,
) {
  const recipients = await recipientsOfParty(partyId, excludeUserId);
  await bulkInsert(recipients, "restaurant_changed", partyId, null, {
    before_name: beforeName,
    after_name: afterName,
  });
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { partyDate: true, kind: true, restaurantName: true },
  });
  await sendPushToUsers(recipients, {
    title: "식당이 바뀌었어요",
    body: `'${beforeName ?? "이전"}' → '${afterName ?? "변경"}' — ${partyLabel(party)}`,
    url: `/party/${partyId}`,
    tag: `restaurant_changed-${partyId}`,
  });
}

/** 새 외식 파티 개설 직후 호출. 호스트 제외한 전 직원에게. (사용자 설정 가능) */
export async function notifyPartyCreated(partyId: string, hostId: string) {
  const [allUsers, party, host] = await Promise.all([
    prisma.profile.findMany({
      where: { id: { not: hostId }, notifNewParties: true },
      select: { id: true },
    }),
    prisma.party.findUnique({
      where: { id: partyId },
      select: { partyDate: true, kind: true, restaurantName: true },
    }),
    prisma.profile.findUnique({ where: { id: hostId }, select: { displayName: true } }),
  ]);
  const recipients = allUsers.map((u) => u.id);
  if (recipients.length === 0) return;

  await bulkInsert(recipients, "party_created", partyId, hostId);
  await sendPushToUsers(recipients, {
    title: "새 외식 파티가 열렸어요",
    body: `${host?.displayName ?? "누군가"} 님 — ${partyLabel(party)}`,
    url: `/party/${partyId}`,
    tag: `party_created-${partyId}`,
  });
}

export type { PushPayload };
