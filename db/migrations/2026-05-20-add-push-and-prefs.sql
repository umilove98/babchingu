-- Web Push 구독 + 알림 환경설정
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

-- 1) PushSubscription 테이블 (endpoint 가 자연 unique 키)
create table if not exists "PushSubscription" (
  id          text primary key,
  "userId"    text not null,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  "userAgent" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "PushSubscription_userId_fkey"
    foreign key ("userId") references "Profile"(id) on delete cascade on update cascade
);

create unique index if not exists "PushSubscription_endpoint_key"
  on "PushSubscription"(endpoint);

create index if not exists "PushSubscription_userId_idx"
  on "PushSubscription"("userId");

-- 2) Profile 에 알림 환경설정 컬럼 3개 (기본 true — 기존 사용자도 자동 ON)
alter table "Profile"
  add column if not exists "notifParticipants" boolean not null default true,
  add column if not exists "notifComments"     boolean not null default true,
  add column if not exists "notifNewParties"   boolean not null default true;
