-- HR Governance workflow stage
create table if not exists hr.hr_approval_policies (
 id uuid primary key default gen_random_uuid(), action_key text not null unique,
 required_role text not null, scope_type text not null default 'global',
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists hr.hr_approval_requests (
 id text primary key, action_key text not null, target_employee_id text,
 target_project_id text, requested_by text, approver_id text,
 status text not null default 'pending', reason text,
 decided_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists hr.hr_audit_log (
 id uuid primary key default gen_random_uuid(), actor_id text, action_key text not null,
 entity_type text not null, entity_id text, before_data jsonb, after_data jsonb,
 reason text, ip_address inet, created_at timestamptz not null default now()
);
create table if not exists hr.hr_conflict_rules (
 id uuid primary key default gen_random_uuid(), action_key text not null,
 rule_key text not null unique, description text not null, active boolean not null default true,
 created_at timestamptz not null default now()
);
create index if not exists idx_hr_approval_requests_status on hr.hr_approval_requests(status, created_at desc);
create index if not exists idx_hr_audit_log_entity on hr.hr_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_hr_audit_log_actor on hr.hr_audit_log(actor_id, created_at desc);
alter table hr.hr_approval_policies enable row level security;
alter table hr.hr_approval_requests enable row level security;
alter table hr.hr_audit_log enable row level security;
alter table hr.hr_conflict_rules enable row level security;
