-- ELNUBY HR operational hardening
-- Egypt deployment + GPS accuracy audit fields + session cleanup support.

alter table hr.attendance add column if not exists check_in_accuracy_m numeric;
alter table hr.attendance add column if not exists check_out_accuracy_m numeric;

alter table hr.attendance drop constraint if exists attendance_gps_accuracy_chk;
alter table hr.attendance add constraint attendance_gps_accuracy_chk
  check (
    (check_in_accuracy_m is null or (check_in_accuracy_m >= 0 and check_in_accuracy_m <= 500))
    and
    (check_out_accuracy_m is null or (check_out_accuracy_m >= 0 and check_out_accuracy_m <= 500))
  );

create index if not exists idx_hr_attendance_employee_date_created
  on hr.attendance(employee_id, date, created_at desc);

-- Keep expired/revoked custom sessions from growing indefinitely.
delete from public.app_sessions where expires_at <= now() or revoked_at is not null;
