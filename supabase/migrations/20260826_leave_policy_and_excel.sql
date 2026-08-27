-- ELNUBY HR: configurable leave policy, residency classification,
-- medical leave documents, accrual ledger and Excel audit support.
-- Apply this migration to the production HR schema before using the new UI.

alter table hr.employees
  add column if not exists residency_type text;

update hr.employees
set residency_type = coalesce(residency_type, 'RESIDENT')
where residency_type is null;

alter table hr.employees
  alter column residency_type set default 'RESIDENT';

alter table hr.employees
  add constraint employees_residency_type_chk
  check (residency_type in ('EXPATRIATE','RESIDENT'));

create table if not exists hr.employee_residency_history (
  history_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  residency_type text not null check (residency_type in ('EXPATRIATE','RESIDENT')),
  effective_from date not null,
  effective_to date,
  created_by text references hr.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_employee_residency_history_employee
  on hr.employee_residency_history(employee_id, effective_from desc);

create table if not exists hr.leave_policies (
  policy_id text primary key,
  name text not null,
  leave_type_id text references hr.leave_types(leave_type_id),
  residency_type text check (residency_type in ('EXPATRIATE','RESIDENT')),
  accrual_method text not null default 'ANNUAL'
    check (accrual_method in ('ANNUAL','PERIODIC','MANUAL')),
  accrual_basis text not null default 'CALENDAR_DAYS'
    check (accrual_basis in ('CALENDAR_DAYS','WORKING_DAYS')),
  accrual_period_days integer,
  accrual_days numeric not null default 0,
  annual_entitlement numeric not null default 0,
  max_carryover_days numeric not null default 0,
  requires_document boolean not null default false,
  allow_partial boolean not null default false,
  effective_from date not null,
  effective_to date,
  version integer not null default 1,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','INACTIVE','DRAFT')),
  created_by text references hr.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (accrual_period_days is null or accrual_period_days > 0),
  check (accrual_days >= 0 and annual_entitlement >= 0)
);

create index if not exists idx_leave_policies_lookup
  on hr.leave_policies(leave_type_id, residency_type, effective_from, status);

create table if not exists hr.leave_accruals (
  accrual_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  leave_type_id text not null references hr.leave_types(leave_type_id),
  policy_id text not null references hr.leave_policies(policy_id),
  cycle_start date not null,
  cycle_end date,
  eligible_days numeric not null default 0,
  earned_days numeric not null default 0,
  used_days numeric not null default 0,
  pending_days numeric not null default 0,
  remaining_days numeric not null default 0,
  status text not null default 'OPEN'
    check (status in ('OPEN','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, leave_type_id, policy_id, cycle_start)
);

create index if not exists idx_leave_accruals_employee
  on hr.leave_accruals(employee_id, leave_type_id, cycle_start desc);

alter table hr.leave_balances
  add column if not exists policy_id text references hr.leave_policies(policy_id),
  add column if not exists cycle_start date,
  add column if not exists cycle_end date,
  add column if not exists source text default 'POLICY';

create table if not exists hr.leave_request_documents (
  document_id text primary key,
  request_id text not null references hr.leave_requests(request_id) on delete cascade,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size integer not null default 0,
  uploaded_by text references hr.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_leave_request_documents_request
  on hr.leave_request_documents(request_id);

alter table hr.leave_requests
  add column if not exists policy_id text references hr.leave_policies(policy_id),
  add column if not exists document_required boolean not null default false;

-- Seed configurable policies for the current company rule.
insert into hr.leave_policies (
  policy_id,name,leave_type_id,residency_type,accrual_method,accrual_basis,
  accrual_period_days,accrual_days,annual_entitlement,max_carryover_days,
  requires_document,allow_partial,effective_from,version,status
)
values
 ('LP-EXPAT-35-7','إجازة المغتربين — 7 أيام لكل 35 يوم','LT-ANNUAL','EXPATRIATE',
  'PERIODIC','CALENDAR_DAYS',35,7,0,0,false,false,'2026-01-01',1,'ACTIVE'),
 ('LP-RESIDENT-21','الإجازة السنوية للمقيمين — 21 يوم','LT-ANNUAL','RESIDENT',
  'ANNUAL','CALENDAR_DAYS',null,0,21,0,false,false,'2026-01-01',1,'ACTIVE'),
 ('LP-SICK','الإجازة المرضية — بمستند مؤيد','LT-SICK',null,
  'MANUAL','CALENDAR_DAYS',null,0,0,0,true,false,'2026-01-01',1,'ACTIVE'),
 ('LP-CASUAL-RES','الإجازة العارضة للمقيمين','LT-CASUAL','RESIDENT',
  'ANNUAL','CALENDAR_DAYS',null,0,7,0,false,false,'2026-01-01',1,'ACTIVE'),
 ('LP-CASUAL-EXP','الإجازة العارضة للمغتربين','LT-CASUAL','EXPATRIATE',
  'ANNUAL','CALENDAR_DAYS',null,0,7,0,false,false,'2026-01-01',1,'ACTIVE'),
 ('LP-UNPAID','الإجازة بدون أجر','LT-UNPAID',null,
  'MANUAL','CALENDAR_DAYS',null,0,0,0,false,false,'2026-01-01',1,'ACTIVE')
on conflict (policy_id) do update set
  name=excluded.name,
  leave_type_id=excluded.leave_type_id,
  residency_type=excluded.residency_type,
  accrual_method=excluded.accrual_method,
  accrual_basis=excluded.accrual_basis,
  accrual_period_days=excluded.accrual_period_days,
  accrual_days=excluded.accrual_days,
  annual_entitlement=excluded.annual_entitlement,
  requires_document=excluded.requires_document,
  updated_at=now();

-- Existing employees default to resident and get a history row from their hire date
-- (or 2026-01-01 when hire date is unavailable).
insert into hr.employee_residency_history(history_id,employee_id,residency_type,effective_from)
select 'ERH-' || substr(md5(e.employee_id || ':' || coalesce(e.hire_date::text,'2026-01-01')),1,12),
       e.employee_id, coalesce(e.residency_type,'RESIDENT'),
       coalesce(e.hire_date, date '2026-01-01')
from hr.employees e
where not exists (
  select 1 from hr.employee_residency_history h
  where h.employee_id=e.employee_id and h.effective_to is null
);

-- Sick leave never consumes an annual balance.
update hr.leave_types
set requires_balance=false, annual_entitlement=0
where leave_type_id='LT-SICK';

-- Private bucket for medical documents. The server uses the service role and
-- creates short-lived signed URLs; files are never public.
insert into storage.buckets(id,name,public)
values ('hr-leave-documents','hr-leave-documents',false)
on conflict (id) do update set public=false;
