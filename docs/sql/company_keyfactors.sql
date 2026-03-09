create table if not exists public.company_keyfactors (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_keyfactors_ticker on public.company_keyfactors(ticker);
