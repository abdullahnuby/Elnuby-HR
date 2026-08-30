-- ELNUBY HR: employee lifecycle / personnel file
create table if not exists public.employment_events (
  event_id text primary key,
  employee_id text not null references public.employees(employee_id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  effective_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_employment_events_employee_date on public.employment_events(employee_id, effective_date desc, created_at desc);
create index if not exists idx_employment_events_type on public.employment_events(event_type);

alter table public.employment_events enable row level security;

drop policy if exists employment_events_service_access on public.employment_events;
create policy employment_events_service_access on public.employment_events for all using (true) with check (true);
