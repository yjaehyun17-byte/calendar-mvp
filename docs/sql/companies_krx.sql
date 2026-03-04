-- companies_krx master table for KRX listed companies
create table if not exists public.companies_krx (
  ticker text primary key,
  name_kr text not null,
  market text null,
  isin text null,
  corp_name text null,
  base_date date null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_companies_krx_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_krx_updated_at on public.companies_krx;
create trigger trg_companies_krx_updated_at
before update on public.companies_krx
for each row
execute function public.set_companies_krx_updated_at();

create index if not exists idx_companies_krx_name_kr
  on public.companies_krx (name_kr);

-- Optional trigram index for faster partial matches.
create extension if not exists pg_trgm;
create index if not exists idx_companies_krx_name_kr_trgm
  on public.companies_krx using gin (name_kr gin_trgm_ops);

-- RLS policy is project-specific.
-- If RLS is enabled, service role key bypasses RLS automatically.
alter table public.companies_krx enable row level security;
