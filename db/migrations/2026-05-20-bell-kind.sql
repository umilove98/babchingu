-- 기습 모임에 kind 컬럼 추가 (coffee / smoke 두 종류)
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

alter table "CoffeeBell"
  add column if not exists kind text not null default 'coffee';

-- 기존 인덱스 대체 — kind 별로 활성 벨 조회 빨라지게
create index if not exists "CoffeeBell_kind_endedAt_createdAt_idx"
  on "CoffeeBell"(kind, "endedAt", "createdAt");
