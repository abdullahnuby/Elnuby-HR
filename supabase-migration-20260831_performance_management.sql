-- ELNUBY HR: performance management / KPI evaluation engine
create table if not exists hr.performance_templates (
  template_id text primary key,
  name text not null,
  job_title text,
  department text,
  project_id text references hr.projects(project_id) on delete set null,
  period_type text not null default 'ANNUAL',
  status text not null default 'ACTIVE',
  created_by text,
  created_at timestamptz not null default now(),
  check (period_type in ('MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL')),
  check (status in ('DRAFT','ACTIVE','ARCHIVED'))
);
create table if not exists hr.performance_template_items (
  item_id text primary key,
  template_id text not null references hr.performance_templates(template_id) on delete cascade,
  title text not null,
  description text,
  weight numeric(6,3) not null default 0,
  max_score numeric(5,2) not null default 5,
  sort_order integer not null default 0,
  check (weight >= 0 and weight <= 100),
  check (max_score > 0)
);
create table if not exists hr.performance_reviews (
  review_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  template_id text not null references hr.performance_templates(template_id) on delete restrict,
  period_start date not null,
  period_end date not null,
  reviewer_user_id text,
  reviewer_role text,
  status text not null default 'DRAFT',
  overall_score numeric(6,3),
  final_rating text,
  strengths text,
  improvement_plan text,
  employee_comment text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (status in ('DRAFT','SUBMITTED','MANAGER_APPROVED','HR_CLOSED','CANCELLED')),
  check (overall_score is null or overall_score >= 0)
);
create table if not exists hr.performance_review_scores (
  score_id text primary key,
  review_id text not null references hr.performance_reviews(review_id) on delete cascade,
  item_id text not null references hr.performance_template_items(item_id) on delete restrict,
  score numeric(6,3) not null,
  comment text,
  created_at timestamptz not null default now(),
  unique(review_id,item_id),
  check (score >= 0)
);
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
create index if not exists idx_performance_reviews_employee_period on hr.performance_reviews(employee_id,period_start desc,period_end desc);
create index if not exists idx_performance_reviews_status on hr.performance_reviews(status);
create index if not exists idx_performance_goals_employee_due on hr.performance_goals(employee_id,due_date);
create index if not exists idx_performance_template_items_template on hr.performance_template_items(template_id,sort_order);
alter table hr.performance_templates enable row level security;
alter table hr.performance_template_items enable row level security;
alter table hr.performance_reviews enable row level security;
alter table hr.performance_review_scores enable row level security;
alter table hr.performance_goals enable row level security;
drop policy if exists performance_templates_service_access on hr.performance_templates;
create policy performance_templates_service_access on hr.performance_templates for all using (true) with check (true);
drop policy if exists performance_template_items_service_access on hr.performance_template_items;
create policy performance_template_items_service_access on hr.performance_template_items for all using (true) with check (true);
drop policy if exists performance_reviews_service_access on hr.performance_reviews;
create policy performance_reviews_service_access on hr.performance_reviews for all using (true) with check (true);
drop policy if exists performance_review_scores_service_access on hr.performance_review_scores;
create policy performance_review_scores_service_access on hr.performance_review_scores for all using (true) with check (true);
drop policy if exists performance_goals_service_access on hr.performance_goals;
create policy performance_goals_service_access on hr.performance_goals for all using (true) with check (true);
