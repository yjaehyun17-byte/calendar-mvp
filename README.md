# Calendar MVP

Supabase 기반 일정 관리 MVP입니다. Google OAuth 로그인 후 캘린더를 사용하고, 한국 상장사 자동완성 검색은 `companies_krx` 테이블에서 조회합니다.

## Router / API 구조

이 프로젝트는 **Next.js App Router(`src/app`)** 구조이며, API는 Route Handler(`src/app/api/**/route.ts`)로 구현되어 있습니다.

- 회사 검색 API: `GET /api/companies?query=삼성` (또는 `q`)
- 상장사 동기화 API: `GET /api/sync-companies`

## 1) Supabase 테이블 생성

아래 SQL 파일을 Supabase SQL Editor에서 먼저 실행하세요.

- `docs/sql/companies_krx.sql`

생성 테이블:
- `companies_krx(ticker PK, name_kr, market, isin, corp_name, base_date, updated_at)`
- `name_kr` 인덱스 + `pg_trgm` GIN 인덱스

> 참고: 동기화 upsert는 **service role key**를 사용하므로 서버에서 RLS 우회가 가능합니다.

## 2) 환경변수 설정

### 로컬 `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

DATA_GO_KR_SERVICE_KEY=...
DATA_GO_KR_KRX_LISTED_ENDPOINT=https://apis.data.go.kr/...

CRON_SECRET=very-strong-secret
```

### Vercel 환경변수

Vercel 프로젝트에도 동일하게 등록하세요.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATA_GO_KR_SERVICE_KEY`
- `DATA_GO_KR_KRX_LISTED_ENDPOINT`
- `CRON_SECRET`

## 3) 첫 실행 순서

1. `docs/sql/companies_krx.sql` 실행
2. env 설정
3. 동기화 API 1회 호출
4. `/api/companies?query=삼성` 결과 확인
5. 캘린더 UI 자동완성 확인

## 4) 동기화 수동 실행 방법

개발 서버 실행 후:

```bash
npm run dev
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/sync-companies"
```

또는 토큰 쿼리 방식:

```bash
curl "http://localhost:3000/api/sync-companies?token=$CRON_SECRET"
```

응답 예시:

```json
{ "ok": true, "fetched": 2800, "upserted": 2800 }
```

## 5) Vercel Cron

`vercel.json`에 매일 15:00 KST(= 06:00 UTC) 스케줄이 설정되어 있습니다.

- 경로: `/api/sync-companies`
- 스케줄: `0 6 * * *`

> Vercel Cron은 **production 배포에서만 실행**됩니다.

## 6) 트러블슈팅 (검색 결과가 빈 배열일 때)

1. `companies_krx` 행 개수 확인 (`select count(*) from companies_krx;`)
2. 동기화 API 응답이 `ok: true`인지 확인
3. `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` 설정 확인
4. `DATA_GO_KR_KRX_LISTED_ENDPOINT`, `DATA_GO_KR_SERVICE_KEY` 유효성 확인
5. RLS 정책/권한 확인 (service role은 서버에서만 사용)

## 7) 개발 실행

```bash
npm install
npm run dev
```

브라우저에서 `/calendar` 접속 후 기업 검색 입력 시 `/api/companies?query=...` 호출로 자동완성됩니다.
