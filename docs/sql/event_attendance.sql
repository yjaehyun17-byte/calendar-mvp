create table if not exists public.event_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id text not null,
  user_name text null,
  user_email text null,
  status text not null check (status in ('attending', 'maybe', 'not_attending')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create or replace function public.set_event_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_event_attendance_updated_at on public.event_attendance;
create trigger trg_event_attendance_updated_at
before update on public.event_attendance
for each row
execute function public.set_event_attendance_updated_at();

alter table public.event_attendance enable row level security;
