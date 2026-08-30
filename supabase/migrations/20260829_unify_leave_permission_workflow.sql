-- توحيد مسار اعتماد الإجازات والأذونات
-- معرفات الطلبات في النظام الحالي نصية (مثل LV... و PR...) وليست UUID.
alter table if exists hr.hr_approval_requests
  alter column id type text using id::text;

alter table if exists hr.hr_approval_requests
  alter column target_employee_id type text using target_employee_id::text;

alter table if exists hr.hr_approval_requests
  alter column target_project_id type text using target_project_id::text;

alter table if exists hr.approval_workflows
  alter column request_id type text using request_id::text;

create index if not exists idx_hr_approval_workflows_pending
  on hr.approval_workflows(status, approver_role, created_at desc);

create index if not exists idx_hr_approval_workflows_request
  on hr.approval_workflows(request_id, step_no);

alter table if exists hr.approval_workflows enable row level security;
alter table if exists hr.hr_approval_requests enable row level security;
alter table if exists hr.hr_audit_log enable row level security;
