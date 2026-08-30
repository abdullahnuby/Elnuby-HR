-- ELNUBY HR: goals and development plans
create table if not exists hr.performance_goals (
  goal_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  review_id text references hr.performance_reviews(review_id) on delete set null,
  title text not null,
  description text,
  target_value text,
  progress_value text,
  weight numeric(6,3) not null default 0,
  due_date date,
  status text not null default 'OPEN',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weight >= 0 and weight <= 100),
  check (status in ('OPEN','ON_TRACK','AT_RISK','ACHIEVED','CANCELLED'))
);
create table if not exists hr.development_plans (
  plan_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  review_id text references hr.performance_reviews(review_id) on delete set null,
  title text not null,
  current_gap text,
  objective text not null,
  actions text,
  support_needed text,
  due_date date,
  status text not null default 'OPEN',
  progress numeric(5,2) not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  check (progress >= 0 and progress <= 100)
);
create index if not exists idx_performance_goals_employee_status on hr.performance_goals(employee_id,status,due_date);
create index if not exists idx_development_plans_employee_status on hr.development_plans(employee_id,status,due_date);
alter table hr.performance_goals enable row level security;
alter table hr.development_plans enable row level security;
drop policy if exists performance_goals_service_access on hr.performance_goals;
create policy performance_goals_service_access on hr.performance_goals for all using (true) with check (true);
drop policy if exists development_plans_service_access on hr.development_plans;
create policy development_plans_service_access on hr.development_plans for all using (true) with check (true);
