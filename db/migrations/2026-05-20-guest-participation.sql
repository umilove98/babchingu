-- 비회원(손님) 참가 — 초대 링크로 접근한 사람용
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

create table if not exists "GuestParticipation" (
  id         text primary key,
  "partyId"  text not null,
  name       text not null,
  token      text not null,
  "joinedAt" timestamp(3) not null default current_timestamp,
  constraint "GuestParticipation_partyId_fkey"
    foreign key ("partyId") references "Party"(id) on delete cascade on update cascade
);

create unique index if not exists "GuestParticipation_partyId_token_key"
  on "GuestParticipation"("partyId", token);

create index if not exists "GuestParticipation_partyId_idx"
  on "GuestParticipation"("partyId");
