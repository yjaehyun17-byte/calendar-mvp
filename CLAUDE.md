# CLAUDE.md — calendar-mvp

## 프로젝트 개요
Google OAuth로 로그인 후 캘린더 이벤트를 관리하는 Supabase 기반 일정 관리 앱.
한국 주식 종목 검색 기능(KRX 데이터) 포함.

## 기술 스택
- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: React 19, FullCalendar, Tailwind CSS v4
- **Backend**: Next.js Route Handlers
- **DB / Auth**: Supabase (PostgreSQL + Google OAuth)
- **Deployment**: Vercel

## 프로젝트 구조
```
src/
  app/
    api/          # Route Handlers (companies, sync-companies 등)
    calendar/     # 캘린더 페이지
    layout.tsx
    page.tsx      # 루트 페이지 (로그인)
  lib/            # Supabase 클라이언트 등 공통 유틸
docs/sql/         # DB 마이그레이션 SQL
scripts/          # 유틸 스크립트
data/             # 정적 데이터
```

## 개발 명령어
```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run lint       # 타입/미사용 변수 체크
npm run build      # 프로덕션 빌드 검증
npm run sync:companies  # KRX 종목 마스터 동기화
```

**규칙**: 새 기능 추가 전 반드시 `npm run lint` + `npm run build` 통과 확인.

## 환경 변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATA_GO_KR_SERVICE_KEY=
DATA_GO_KR_KRX_LISTED_ENDPOINT=
CRON_SECRET=
```
설정: `cp .env.example .env.local`

## DB 초기 설정 (Supabase SQL Editor)
1. `docs/sql/companies_krx.sql` 실행
2. `docs/sql/event_attendance.sql` 실행 (선택)

## Google OAuth 설정
1. Supabase > Authentication > Providers > Google 활성화
2. Google Cloud Console에서 Client ID/Secret 발급
3. Redirect URI 등록: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
4. Supabase > Authentication > URL Configuration에서 Site URL / Redirect URL 등록

## 주요 API
- `GET /api/companies?query=삼성` — 종목 검색
- `GET /api/sync-companies` — 종목 마스터 동기화

## 알려진 이슈
- "Unsupported provider" 오류 → 코드 문제 아님. Supabase에서 Google Provider 활성화 후 10-20초 대기 후 저장 확인.
