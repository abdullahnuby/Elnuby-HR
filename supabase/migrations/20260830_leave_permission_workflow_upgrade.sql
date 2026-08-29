-- ELNUBY HR: richer leave/permission workflow metadata.
-- Adds cancellation audit fields without breaking existing records.

alter table hr.leave_requests
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text;

alter table hr.permission_requests
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text;

create index if not exists idx_hr_leave_requests_status_created
  on hr.leave_requests(status, created_at desc);
create index if not exists idx_hr_permission_requests_status_created
  on hr.permission_requests(status, created_at desc);

-- Explicit status guardrails.
alter table hr.leave_requests drop constraint if exists leave_requests_status_chk;
alter table hr.leave_requests add constraint leave_requests_status_chk
  check (status in ('PENDING_MANAGER','PENDING_HR','APPROVED','REJECTED','CANCELLED'));

alter table hr.permission_requests drop constraint if exists permission_requests_status_chk;
alter table hr.permission_requests add constraint permission_requests_status_chk
  check (status in ('PENDING','APPROVED','REJECTED','CANCELLED'));
