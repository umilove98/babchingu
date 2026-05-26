-- 프로필 메뉴 태그 — 좋아하는/싫어하는 메뉴를 콤마 구분 문자열로 저장
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

alter table "Profile"
  add column if not exists "favoriteMenus" text not null default '',
  add column if not exists "dislikedMenus" text not null default '';
