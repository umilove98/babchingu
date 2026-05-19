-- 휴일 등록 기능 추가
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

create table if not exists "CustomHoliday" (
  date        text primary key,                            -- 'YYYY-MM-DD'
  reason      text not null,
  "createdBy" text,
  "createdAt" timestamptz not null default now()
);
