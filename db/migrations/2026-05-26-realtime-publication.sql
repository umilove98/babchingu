-- 실시간 구독 대상 테이블 추가
-- 외식 추가/사람 추가/댓글 추가 등을 새로고침 없이 클라이언트에 푸시하기 위함.
-- 실행: Supabase SQL Editor 에 붙여넣고 Run

alter publication supabase_realtime add table "Party";
alter publication supabase_realtime add table "Participation";
alter publication supabase_realtime add table "GuestParticipation";
alter publication supabase_realtime add table "Comment";
alter publication supabase_realtime add table "RestaurantChangeRequest";
