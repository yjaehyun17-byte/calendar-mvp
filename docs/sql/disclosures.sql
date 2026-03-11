create table if not exists public.disclosures (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  label text not null default '',
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_disclosures_date on public.disclosures(date desc);

alter table public.disclosures enable row level security;

-- service role은 RLS 우회하므로 별도 policy 불필요
