-- 기습 커피 모임 (Coffee Bell) — 전 조직 동시 1개 활성
-- 실행: Supabase SQL Editor 에 붙여넣고 Run
-- 마지막에 supabase_realtime publication 에 테이블을 add 하므로 RLS 없이 anon/authenticated 모두 변경 이벤트 수신 가능
-- (사내 앱 + iron-session 기반이라 RLS 사용 안 함, 이전 다른 테이블과 동일)

create table if not exists "CoffeeBell" (
  id            text primary key,
  "initiatorId" text not null,
  timing        text not null,
  "createdAt"   timestamp(3) not null default current_timestamp,
  "endedAt"     timestamp(3),
  constraint "CoffeeBell_initiatorId_fkey"
    foreign key ("initiatorId") references "Profile"(id) on delete cascade on update cascade
);

create index if not exists "CoffeeBell_endedAt_createdAt_idx"
  on "CoffeeBell"("endedAt", "createdAt");

create table if not exists "CoffeeBellTarget" (
  "coffeeBellId" text not null,
  "userId"       text not null,
  available      boolean not null default false,
  "respondedAt"  timestamp(3),
  primary key ("coffeeBellId", "userId"),
  constraint "CoffeeBellTarget_coffeeBellId_fkey"
    foreign key ("coffeeBellId") references "CoffeeBell"(id) on delete cascade on update cascade,
  constraint "CoffeeBellTarget_userId_fkey"
    foreign key ("userId") references "Profile"(id) on delete cascade on update cascade
);

create index if not exists "CoffeeBellTarget_userId_idx"
  on "CoffeeBellTarget"("userId");

create table if not exists "CoffeeBellMessage" (
  id             text primary key,
  "coffeeBellId" text not null,
  "userId"       text not null,
  body           text not null,
  "createdAt"    timestamp(3) not null default current_timestamp,
  constraint "CoffeeBellMessage_coffeeBellId_fkey"
    foreign key ("coffeeBellId") references "CoffeeBell"(id) on delete cascade on update cascade,
  constraint "CoffeeBellMessage_userId_fkey"
    foreign key ("userId") references "Profile"(id) on delete cascade on update cascade
);

create index if not exists "CoffeeBellMessage_coffeeBellId_createdAt_idx"
  on "CoffeeBellMessage"("coffeeBellId", "createdAt");

-- Supabase Realtime — 클라이언트가 변경 이벤트 구독할 수 있도록 publication 에 add
-- (publication 이 없거나 이미 추가되어 있어도 에러 안 나게 안전하게 처리)
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table "CoffeeBell";
alter publication supabase_realtime add table "CoffeeBellTarget";
alter publication supabase_realtime add table "CoffeeBellMessage";
