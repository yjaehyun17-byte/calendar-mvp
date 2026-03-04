# Calendar MVP

Supabase 기반 일정 관리 MVP입니다. Google OAuth 로그인 후 일정을 확인/수정할 수 있습니다.

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

2. Supabase 대시보드에서 **Authentication > Providers > Google** 를 활성화하고, Google Cloud에서 발급한 **Client ID / Client Secret** 을 저장하세요.
3. Google Cloud Console > OAuth 클라이언트의 승인된 Redirect URI에 아래 주소를 추가하세요.
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Supabase **Authentication > URL Configuration** 에 아래를 등록하세요.
   - Site URL: `http://localhost:3000` (로컬) / 실제 배포 URL
   - Redirect URLs: `http://localhost:3000/calendar`, `https://<your-domain>/calendar`

## 7) 개발 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 후 Google 로그인 버튼으로 인증할 수 있습니다.

## Troubleshooting

- `{"msg":"Unsupported provider: provider is not enabled"}` 오류가 나오면:
  1) Supabase의 Google Provider가 실제로 **Enabled** 상태인지 확인
  2) Client ID/Secret 저장 후 **Save** 버튼을 눌렀는지 확인
  3) 저장 후 10~20초 뒤 다시 시도 (설정 반영 지연 가능)
  4) 배포 URL이 바뀌었다면 Supabase URL Configuration의 Redirect URLs에 새 URL(예: `https://calendar-mvp-swart.vercel.app/calendar`)을 추가

> 이 오류는 코드가 아니라 Supabase 프로젝트 설정 문제로 발생합니다. Provider를 켜면 같은 코드로 정상 로그인됩니다.
