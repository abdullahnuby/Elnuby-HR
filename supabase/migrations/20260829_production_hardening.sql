-- ELNUBY HR production hardening (2026-08-29)
-- Defense-in-depth constraints for overlapping requests and concurrency-safe writes.

-- Permissions: keep same-employee active requests from overlapping even when
-- two requests are submitted concurrently. A transaction-scoped advisory lock
-- serializes writes for the employee, then the trigger validates the interval.
create or replace function hr.prevent_permission_overlap()
returns trigger
language plpgsql
security definer
set search_path = hr, public
as $$
declare
  lock_key bigint;
begin
  if NEW.employee_id is null or NEW.date is null or NEW.start_time is null or NEW.end_time is null then
    return NEW;
  end if;

  if NEW.end_time <= NEW.start_time then
    raise exception using message = 'Permission end time must be after start time';
  end if;

  if NEW.status in ('PENDING', 'APPROVED') then
    lock_key := hashtextextended(NEW.employee_id, 73921);
    perform pg_advisory_xact_lock(lock_key);

    if exists (
      select 1
      from hr.permission_requests p
      where p.employee_id = NEW.employee_id
        and p.date = NEW.date
        and p.status in ('PENDING', 'APPROVED')
        and p.request_id <> coalesce(NEW.request_id, '')
        and NEW.start_time < p.end_time
        and p.start_time < NEW.end_time
    ) then
      raise exception using message = 'Permission period overlaps an existing active request';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_permission_overlap on hr.permission_requests;
create trigger trg_permission_overlap
before insert or update of employee_id, date, start_time, end_time, status
on hr.permission_requests
for each row execute function hr.prevent_permission_overlap();

create index if not exists idx_hr_permission_requests_employee_date_status
  on hr.permission_requests(employee_id, date, status);

-- Leave requests: a transaction-scoped employee lock makes the overlap check
-- race-safe. Pending/approved requests reserve the employee's date range.
create or replace function hr.prevent_leave_overlap()
returns trigger
language plpgsql
security definer
set search_path = hr, public
as $$
declare
  lock_key bigint;
begin
  if NEW.employee_id is null or NEW.from_date is null or NEW.to_date is null then
    return NEW;
  end if;

  if NEW.to_date < NEW.from_date then
    raise exception using message = 'Leave end date must be on or after start date';
  end if;

  if NEW.status in ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED') then
    lock_key := hashtextextended(NEW.employee_id, 18437);
    perform pg_advisory_xact_lock(lock_key);

    if exists (
      select 1
      from hr.leave_requests r
      where r.employee_id = NEW.employee_id
        and r.status in ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED')
        and r.request_id <> coalesce(NEW.request_id, '')
        and NEW.from_date <= r.to_date
        and r.from_date <= NEW.to_date
    ) then
      raise exception using message = 'Leave dates overlap an existing active request';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_leave_overlap on hr.leave_requests;
create trigger trg_leave_overlap
before insert or update of employee_id, from_date, to_date, status
on hr.leave_requests
for each row execute function hr.prevent_leave_overlap();

create index if not exists idx_hr_leave_requests_employee_dates_status
  on hr.leave_requests(employee_id, from_date, to_date, status);

-- Attendance integrity: never allow negative duration values. Overnight shifts are
-- handled by server-side elapsed-time logic, so raw TIME ordering is not constrained.
alter table hr.attendance drop constraint if exists attendance_minutes_nonnegative_chk;
alter table hr.attendance add constraint attendance_minutes_nonnegative_chk
  check (coalesce(late_minutes, 0) >= 0 and coalesce(worked_minutes, 0) >= 0);

-- Do not compare TIME values directly here: valid overnight shifts can check out
-- after midnight with a smaller clock value than check-in. The server computes
-- elapsed minutes with overnight-aware logic instead.

-- Valid time strings are expected in the application/DB as time values.
-- Explicitly keep the canonical employee/date uniqueness invariant.
create unique index if not exists uq_hr_attendance_employee_date
  on hr.attendance(employee_id, date);

-- Persist the permission category used by the frontend while remaining backward compatible.
alter table hr.permission_requests add column if not exists permission_type text not null default 'GENERAL';

-- Prevent concurrent creation of more than one active account for the same employee.
-- This is trigger-based so existing duplicate legacy rows do not block migration;
-- only new INSERT/UPDATE operations are rejected.
create or replace function hr.prevent_duplicate_active_employee_user()
returns trigger
language plpgsql
security definer
set search_path = hr, public
as $$
declare
  lock_key bigint;
begin
  if NEW.employee_id is null or NEW.status <> 'ACTIVE' then
    return NEW;
  end if;

  lock_key := hashtextextended(NEW.employee_id, 55109);
  perform pg_advisory_xact_lock(lock_key);

  if exists (
    select 1 from hr.users u
    where u.employee_id = NEW.employee_id
      and u.status = 'ACTIVE'
      and u.id <> coalesce(NEW.id, '')
  ) then
    raise exception using message = 'Employee already has an active user account';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_prevent_duplicate_active_employee_user on hr.users;
create trigger trg_prevent_duplicate_active_employee_user
before insert or update of employee_id, status
on hr.users
for each row execute function hr.prevent_duplicate_active_employee_user();

revoke execute on function hr.prevent_permission_overlap() from public;
revoke execute on function hr.prevent_leave_overlap() from public;
revoke execute on function hr.prevent_duplicate_active_employee_user() from public;
