create table if not exists public.company_memos (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  visit_date date not null,
  summary text not null default '',
  timeline jsonb not null default '[]',
  details text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 이미 테이블이 있는 경우 timeline 컬럼만 추가
alter table public.company_memos
  add column if not exists timeline jsonb not null default '[]';

create index if not exists idx_company_memos_ticker on public.company_memos(ticker);

create or replace function public.set_company_memos_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_company_memos_updated_at on public.company_memos;
create trigger trg_company_memos_updated_at
before update on public.company_memos
for each row execute function public.set_company_memos_updated_at();

alter table public.company_memos enable row level security;
