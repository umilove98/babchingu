-- ============================================================
-- 밥친구 — Supabase Postgres 이전용 최종 스키마
-- 1차 로컬 개발은 Prisma + SQLite. 이 파일은 Supabase 배포 시 한번에 실행.
-- 실행 순서: 1) 테이블 → 2) 인덱스 → 3) 트리거 → 4) RLS
-- ============================================================

-- Supabase Auth 의 auth.users 와 1:1 대응하는 profiles 를 가정.
-- Auth 자체 구현 (iron-session) 그대로 가져가려면 password_hash 컬럼 유지.

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

create table profiles (
  id              uuid primary key default uuid_generate_v4(),
  username        text unique not null,
  display_name    text not null,
  password_hash   text not null,
  avatar_seed     text not null,
  avatar_url      text,
  can_host        boolean not null default false,
  is_admin        boolean not null default false,
  favorite_menus  text not null default '',
  disliked_menus  text not null default '',
  created_at      timestamptz not null default now()
);

create table parties (
  id              text primary key,                 -- 'dos_YYYY-MM-DD' 또는 cuid
  party_date      date not null,
  kind            text not null check (kind in ('dosirak','eatout')),
  restaurant_name text,
  map_url         text,
  host_id         uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table participations (
  party_id  text not null references parties(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table comments (
  id         uuid primary key default uuid_generate_v4(),
  party_id   text not null references parties(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table restaurant_change_requests (
  id            uuid primary key default uuid_generate_v4(),
  party_id      text not null references parties(id) on delete cascade,
  requester_id  uuid not null references profiles(id) on delete cascade,
  new_name      text not null,
  new_map_url   text,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('new_member','new_comment','change_requested','restaurant_changed','invited','left')),
  party_id   text references parties(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. 인덱스
-- ------------------------------------------------------------
create index idx_parties_date on parties(party_date);
create index idx_parties_host_date on parties(host_id, party_date);
create index idx_participations_user on participations(user_id);
create index idx_comments_party_created on comments(party_id, created_at);
create index idx_change_req_party_status on restaurant_change_requests(party_id, status);
create index idx_notifications_user_read_created on notifications(user_id, read_at, created_at desc);

-- 도시락은 결정적 ID 로 중복 방지하지만, 방어적으로 부분 unique 인덱스 추가
create unique index uniq_dosirak_per_day
  on parties(party_date) where kind = 'dosirak';

-- ------------------------------------------------------------
-- 3. 알림 트리거 — DB 레벨에서 누락 방지
-- ------------------------------------------------------------

-- 3-1. 참가 → new_member
create or replace function notify_new_member() returns trigger as $$
declare
  recipient uuid;
begin
  for recipient in
    select user_id from participations
    where party_id = new.party_id and user_id <> new.user_id
    union
    select host_id from parties where id = new.party_id and host_id is not null and host_id <> new.user_id
  loop
    insert into notifications(user_id, kind, party_id, actor_id)
    values (recipient, 'new_member', new.party_id, new.user_id);
  end loop;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_new_member
after insert on participations
for each row execute function notify_new_member();

-- 3-2. 댓글 → new_comment
create or replace function notify_new_comment() returns trigger as $$
declare
  recipient uuid;
begin
  for recipient in
    select user_id from participations
    where party_id = new.party_id and user_id <> new.user_id
    union
    select host_id from parties where id = new.party_id and host_id is not null and host_id <> new.user_id
  loop
    insert into notifications(user_id, kind, party_id, actor_id)
    values (recipient, 'new_comment', new.party_id, new.user_id);
  end loop;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_new_comment
after insert on comments
for each row execute function notify_new_comment();

-- 3-3. 식당 변경 제안 → change_requested (호스트에게만)
create or replace function notify_change_requested() returns trigger as $$
declare host uuid;
begin
  select host_id into host from parties where id = new.party_id;
  if host is not null and host <> new.requester_id then
    insert into notifications(user_id, kind, party_id, actor_id, payload)
    values (host, 'change_requested', new.party_id, new.requester_id,
            jsonb_build_object('new_name', new.new_name, 'reason', new.reason));
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_change_requested
after insert on restaurant_change_requests
for each row execute function notify_change_requested();

-- 3-4. 식당 변경(approved) → restaurant_changed (참가자 전원에게)
create or replace function notify_restaurant_changed() returns trigger as $$
declare
  recipient uuid;
begin
  if new.restaurant_name is distinct from old.restaurant_name
     or new.map_url is distinct from old.map_url then
    for recipient in
      select user_id from participations where party_id = new.id
      union
      select new.host_id where new.host_id is not null
    loop
      insert into notifications(user_id, kind, party_id, payload)
      values (recipient, 'restaurant_changed', new.id,
              jsonb_build_object(
                'before_name', old.restaurant_name,
                'after_name',  new.restaurant_name
              ));
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_restaurant_changed
after update on parties
for each row execute function notify_restaurant_changed();

-- ------------------------------------------------------------
-- 4. RLS — 행 단위 권한 강제
-- ------------------------------------------------------------
alter table profiles                    enable row level security;
alter table parties                     enable row level security;
alter table participations              enable row level security;
alter table comments                    enable row level security;
alter table restaurant_change_requests  enable row level security;
alter table notifications               enable row level security;

-- 모든 인증 사용자는 다른 사용자의 표시명을 볼 수 있어야 함
create policy "profiles_select_authenticated" on profiles
  for select to authenticated using (true);

-- 본인 프로필 수정만
create policy "profiles_update_self" on profiles
  for update to authenticated using (id = auth.uid());

-- parties: 모두 조회 가능
create policy "parties_select_all" on parties
  for select to authenticated using (true);

-- 외식 등록: can_host=true 만
create policy "parties_insert_eatout_host" on parties
  for insert to authenticated with check (
    kind = 'eatout'
    and exists (select 1 from profiles where id = auth.uid() and can_host = true)
    and host_id = auth.uid()
  );

-- 도시락 lazy insert: 누구나
create policy "parties_insert_dosirak_anyone" on parties
  for insert to authenticated with check (
    kind = 'dosirak' and host_id is null
  );

-- 호스트만 수정/삭제
create policy "parties_update_host" on parties
  for update to authenticated using (host_id = auth.uid());
create policy "parties_delete_host" on parties
  for delete to authenticated using (host_id = auth.uid());

-- participations: 모두 조회 가능, 본인만 insert/delete
create policy "participations_select_all" on participations
  for select to authenticated using (true);
create policy "participations_insert_self" on participations
  for insert to authenticated with check (user_id = auth.uid());
create policy "participations_delete_self" on participations
  for delete to authenticated using (user_id = auth.uid());

-- comments: 조회 모두, 작성 본인, 삭제 본인
create policy "comments_select_all" on comments
  for select to authenticated using (true);
create policy "comments_insert_self" on comments
  for insert to authenticated with check (user_id = auth.uid());
create policy "comments_delete_self" on comments
  for delete to authenticated using (user_id = auth.uid());

-- 변경 제안: 외식 파티 참가자만 등록, 호스트만 승인
create policy "change_req_select_party_members" on restaurant_change_requests
  for select to authenticated using (
    exists (
      select 1 from participations p
      where p.party_id = restaurant_change_requests.party_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from parties pa
      where pa.id = restaurant_change_requests.party_id and pa.host_id = auth.uid()
    )
  );
create policy "change_req_insert_party_member" on restaurant_change_requests
  for insert to authenticated with check (
    requester_id = auth.uid()
    and exists (
      select 1 from parties pa
      where pa.id = party_id and pa.kind = 'eatout'
    )
    and exists (
      select 1 from participations p
      where p.party_id = restaurant_change_requests.party_id and p.user_id = auth.uid()
    )
  );
create policy "change_req_update_host" on restaurant_change_requests
  for update to authenticated using (
    exists (
      select 1 from parties pa
      where pa.id = party_id and pa.host_id = auth.uid()
    )
  );

-- notifications: 본인 것만 조회/수정
create policy "notifications_select_self" on notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_self" on notifications
  for update to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5. Realtime publication
-- ------------------------------------------------------------
-- 새 알림을 클라이언트가 구독할 수 있도록 supabase_realtime 에 등록
alter publication supabase_realtime add table notifications;
