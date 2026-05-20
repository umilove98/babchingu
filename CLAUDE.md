# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트 개요

**밥친구 (Bapchingu)** — 사내 점심 모임 앱. 평일 5일 캘린더에서 도시락(공용 자리)과 외식(호스트 주도) 두 종류의 파티를 모집한다. 코멘트·알림·아바타·관리자 패널 포함. UI 텍스트는 한국어.

## 명령어

```bash
npm run dev          # next dev
npm run build        # next build
npm run lint         # eslint (Flat config)

npm run db:push      # prisma db push — 스키마 동기화 (마이그레이션 없이)
npm run db:migrate   # prisma migrate dev — 새 마이그레이션 생성
npm run db:reset     # prisma migrate reset — DB 초기화 + seed 재실행
npm run db:studio    # prisma studio
npm run db:seed      # tsx prisma/seed.ts — admin/alice/bob 등 시드 (비밀번호: password)
```

`postinstall` 에서 `prisma generate` 자동 실행. 테스트 러너는 설정되어 있지 않다.

## 환경변수 (`.env`)

`.env.example` 참고. 셋 다 필수:

- `DATABASE_URL` — Supabase Transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`). 앱 런타임.
- `DIRECT_URL` — Direct connection (port 5432). Prisma migrate 전용.
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — 아바타 업로드 (Storage `avatars` 버킷).
- `SESSION_SECRET` — iron-session 키, **32자 이상 필수** (미달 시 부팅 실패).

## 아키텍처 핵심

### 인증
**iron-session 쿠키 기반** (NextAuth/Supabase Auth 아님). bcrypt 로 비밀번호 해시. 헬퍼는 `src/lib/auth.ts`:

- `getMeOrRedirect()` — 서버 컴포넌트/레이아웃. 미인증 시 `/login` 으로 리다이렉트.
- `requireMe()` — API Route. 미인증 시 throw, 호출부에서 401 응답.
- `requireAdmin()` — `isAdmin` 검사까지. 403.

세션 쿠키 `babchingu_session`, 30일 유지. 라우트 그룹 `src/app/(app)/` 안쪽은 모두 로그인 필요 (`(app)/layout.tsx` 에서 강제).

### DB / Prisma
`src/lib/db.ts` 에서 **싱글톤 `prisma`** export (dev HMR 대비 `globalThis` 캐싱). 항상 이걸 import 한다. 새 `PrismaClient()` 만들지 말 것.

스키마는 `prisma/schema.prisma`. Postgres 이전 대비 SQL 은 `db/postgres-schema.sql` 에 별도로 유지 (애플리케이션 레이어 알림 로직을 DB 트리거로 대체하는 버전).

### 날짜 처리 — 모두 'YYYY-MM-DD' 문자열 (KST)
**중요**: `Party.partyDate`, `CustomHoliday.date` 등 모든 날짜는 `Date` 타입이 아니라 `'YYYY-MM-DD'` 문자열이다. SQLite Date 회피용 흔적이 Postgres 마이그레이션 후에도 남아있다. 사전적 비교만으로 과거/오늘 판정 가능 (`isPast`, `isToday` in `src/lib/date.ts`).

주차는 ISO-8601 `'YYYY-Www'` (월요일 기준, 평일 5일치 보여줌). `mondayOfIsoWeek`, `daysFrom`, `shiftIsoWeek` 사용.

### 파티 ID 규칙
- **도시락** — 같은 날 1개만. ID 는 결정적 `dos_YYYY-MM-DD` (`dosirakIdFor()`). `prisma.party.upsert` 로 동시성 안전하게 생성.
- **외식** — 같은 날 같은 호스트가 여러 식당 등록 가능. cuid.

같은 날 동시 참가 차단은 `enforceSingleDayJoin()` 가 처리 — 다른 파티에서 자동 탈퇴시키고 호스트에게 떠남 알림 발송.

### 휴일
`src/lib/holidays.ts` 의 `STATIC_HOLIDAYS` (2025–2027 법정공휴일 하드코딩) + `CustomHoliday` 테이블 (관리자 등록). 도시락 참가·외식 등록은 모두 휴일·과거 날짜에서 차단된다.

### 알림 (애플리케이션 레이어)
`src/lib/notify.ts`. SQLite 시절 트리거 대용으로 만들어진 구조이며 Postgres 로 옮겨도 그대로 사용. `Notification.kind` ∈ `{ new_member, new_comment, change_requested, restaurant_changed, invited, left }`. `payload` 는 JSON 문자열로 직렬화 (before/after 식당명 등).

### Supabase Storage (아바타)
`src/lib/supabase.ts` 는 **service_role 키** 를 쓰므로 서버 전용. 클라이언트 컴포넌트에서 import 금지. 버킷 이름 상수 `AVATAR_BUCKET = "avatars"`.

### 라우팅 구조
- `src/app/(app)/...` — 인증 필요. 메인 캘린더, 업적, 알림, 파티 상세, 주차 페이지, 관리자.
- `src/app/(auth)/login` — 로그인.
- `src/app/api/...` — Route Handlers. 모두 zod 로 입력 검증, 에러 메시지는 한국어로 응답.

## 컨벤션

- Path alias: `@/*` → `src/*`.
- Validation: zod (`schema.safeParse`, 첫 issue 메시지를 응답으로).
- Client 데이터 페칭: TanStack Query, 폼은 react-hook-form + `@hookform/resolvers/zod`.
- Tailwind 4 (`@theme` 토큰을 `src/app/globals.css` 에 정의 — 색상 토큰명: `cream`, `butter`, `peach`, `mint`, `sky`, `ink` 등. 실제 색은 amber/orange 톤).
- Vercel 배포 리전: `hnd1` (도쿄, `vercel.json`).
