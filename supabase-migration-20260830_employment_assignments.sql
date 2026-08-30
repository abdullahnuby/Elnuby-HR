-- ELNUBY HR: contracts, project assignments and temporary delegations
create table if not exists hr.employee_contracts (
  contract_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  contract_type text not null default 'PERMANENT',
  start_date date not null,
  end_date date,
  status text not null default 'ACTIVE',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (status in ('DRAFT','ACTIVE','EXPIRED','TERMINATED','RENEWED'))
);
create index if not exists idx_employee_contracts_employee_dates on hr.employee_contracts(employee_id,start_date desc,end_date desc);
create index if not exists idx_employee_contracts_end_date on hr.employee_contracts(end_date) where end_date is not null;
alter table hr.employee_contracts enable row level security;
drop policy if exists employee_contracts_service_access on hr.employee_contracts;
create policy employee_contracts_service_access on hr.employee_contracts for all using (true) with check (true);

create table if not exists hr.employee_delegations (
  delegation_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  project_id text references hr.projects(project_id) on delete set null,
  delegation_type text not null default 'TEMPORARY_ASSIGNMENT',
  start_date date not null,
  end_date date,
  reason text,
  status text not null default 'ACTIVE',
  created_by text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (status in ('ACTIVE','ENDED','CANCELLED'))
);
create index if not exists idx_employee_delegations_employee_dates on hr.employee_delegations(employee_id,start_date desc,end_date desc);
alter table hr.employee_delegations enable row level security;
drop policy if exists employee_delegations_service_access on hr.employee_delegations;
create policy employee_delegations_service_access on hr.employee_delegations for all using (true) with check (true);
