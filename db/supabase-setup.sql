-- ============================================================
-- 밥친구 — Supabase 배포 초기 셋업
-- 사용: Supabase Dashboard → SQL Editor → 이 파일 전체 붙여넣기 → Run
-- 한 번만 실행. 테이블·인덱스·기본 관리자 계정 생성.
-- 알림(트리거) 로직은 앱 코드(lib/notify.ts)에서 처리하므로 DB 트리거 불필요.
-- RLS 도 사용 안 함 (iron-session 기반 서버 측 인증 → Prisma 가 service_role 권한으로 접근).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

create table if not exists "Profile" (
  id             text primary key,
  username       text unique not null,
  "displayName"  text not null,
  "passwordHash" text not null,
  "avatarSeed"   text not null,
  "avatarUrl"    text,
  "canHost"      boolean not null default false,
  "isAdmin"      boolean not null default false,
  "createdAt"    timestamptz not null default now()
);

create table if not exists "Party" (
  id               text primary key,
  "partyDate"      text not null,                          -- 'YYYY-MM-DD'
  kind             text not null,                          -- 'dosirak' | 'eatout'
  "restaurantName" text,
  "mapUrl"         text,
  "hostId"         text references "Profile"(id) on delete set null,
  "createdAt"      timestamptz not null default now()
);

create table if not exists "Participation" (
  "partyId"  text not null references "Party"(id) on delete cascade,
  "userId"   text not null references "Profile"(id) on delete cascade,
  "joinedAt" timestamptz not null default now(),
  primary key ("partyId", "userId")
);

create table if not exists "Comment" (
  id          text primary key,
  "partyId"   text not null references "Party"(id) on delete cascade,
  "userId"    text not null references "Profile"(id) on delete cascade,
  body        text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists "RestaurantChangeRequest" (
  id             text primary key,
  "partyId"      text not null references "Party"(id) on delete cascade,
  "requesterId"  text not null references "Profile"(id) on delete cascade,
  "newName"      text not null,
  "newMapUrl"    text,
  reason         text,
  status         text not null default 'pending',          -- 'pending' | 'approved' | 'rejected'
  "resolvedAt"   timestamptz,
  "createdAt"    timestamptz not null default now()
);

create table if not exists "Notification" (
  id          text primary key,
  "userId"    text not null references "Profile"(id) on delete cascade,
  kind        text not null,                               -- 'new_member' | 'new_comment' | 'change_requested' | 'restaurant_changed' | 'invited' | 'left'
  "partyId"   text references "Party"(id) on delete cascade,
  "actorId"   text references "Profile"(id) on delete set null,
  payload     text,                                        -- JSON 문자열
  "readAt"    timestamptz,
  "createdAt" timestamptz not null default now()
);

create table if not exists "CustomHoliday" (
  date        text primary key,                            -- 'YYYY-MM-DD'
  reason      text not null,
  "createdBy" text,
  "createdAt" timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. 인덱스
-- ------------------------------------------------------------
create index if not exists "Party_partyDate_idx" on "Party"("partyDate");
create index if not exists "Party_hostId_partyDate_idx" on "Party"("hostId", "partyDate");
create index if not exists "Participation_userId_idx" on "Participation"("userId");
create index if not exists "Comment_partyId_createdAt_idx" on "Comment"("partyId", "createdAt");
create index if not exists "RestaurantChangeRequest_partyId_status_idx"
  on "RestaurantChangeRequest"("partyId", status);
create index if not exists "Notification_userId_readAt_createdAt_idx"
  on "Notification"("userId", "readAt", "createdAt" desc);

-- 도시락은 결정적 ID (dos_YYYY-MM-DD) 로 중복 방지하지만, 방어적 부분 unique 인덱스
create unique index if not exists "uniq_dosirak_per_day"
  on "Party"("partyDate") where kind = 'dosirak';

-- ------------------------------------------------------------
-- 3. 초기 관리자 계정
-- 아이디: admin / 비밀번호: password
-- 첫 로그인 후 반드시 관리자 페이지에서 비번 재발급 권장.
-- ------------------------------------------------------------
insert into "Profile" (id, username, "displayName", "passwordHash", "avatarSeed", "canHost", "isAdmin")
values (
  'init_admin_account',
  'admin',
  '관리자',
  '$2b$10$UXYspXo72ICRAR7Au6r7NeuYZXgCj.VPxAGJqmV0LdFRZhFB4FOvG',
  'admin',
  true,
  true
)
on conflict (username) do nothing;
