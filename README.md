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
