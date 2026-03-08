create table if not exists public.company_checklists (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  content text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_checklists_ticker on public.company_checklists(ticker);
