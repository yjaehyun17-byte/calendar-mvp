create table if not exists public.universe_event_checks (
  -- event_id: "{ticker}-{visit_date}-{timeline_index}" 형식
  event_id text primary key,
  ticker text not null,
  checked_at timestamptz not null default now()
);

create index if not exists idx_universe_event_checks_ticker on public.universe_event_checks(ticker);
