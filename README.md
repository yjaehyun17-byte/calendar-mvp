# Calendar MVP

Supabase 기반 일정 관리 MVP입니다. 이제 Google OAuth 로그인 후 일정을 확인/수정할 수 있습니다.

## Getting Started

1. `.env.local` 파일을 만들고 아래 환경 변수를 설정하세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Supabase 대시보드에서 **Authentication > Providers > Google** 를 활성화하세요.
3. Google Cloud Console OAuth 클라이언트의 승인된 Redirect URI에 아래 주소를 추가하세요.
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Supabase **Authentication > URL Configuration** 에 사이트 URL(예: `http://localhost:3000`)을 등록하세요.

그다음 개발 서버를 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 후 Google 로그인 버튼으로 인증할 수 있습니다.

## 상장사 마스터 자동화 (웹 데이터 기반)

기업 검색의 안정성을 위해 `data/krx-master.json` 파일을 우선 사용하고, 파일에 데이터가 없으면 Google Finance 검색으로 폴백합니다.

### 1) 상장사 마스터 동기화

아래처럼 웹에서 내려받을 수 있는 CSV/JSON URL을 환경변수로 지정해 동기화할 수 있습니다.

```bash
KRX_MASTER_SOURCE_URL='https://<your-web-source>.csv-or-json' npm run sync:companies
```

- CSV일 경우 아래 컬럼명 중 일부를 포함하면 자동 매핑합니다.
  - 회사명: `name`, `company_name`, `종목명`, `회사명`
  - 종목코드: `ticker`, `code`, `stock_code`, `단축코드`, `종목코드`
  - 시장구분: `market`, `시장구분`, `market_type`, `시장`
- JSON일 경우 `{ name, ticker, market }` 형태 배열을 권장합니다.

### 2) 운영 자동화

서버/배치에서 하루 1회 `npm run sync:companies` 실행(크론)으로 상장사 DB를 자동 갱신할 수 있습니다.
