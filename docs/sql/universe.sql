create table if not exists public.universe (
  ticker text primary key,
  added_at timestamptz not null default now()
);
