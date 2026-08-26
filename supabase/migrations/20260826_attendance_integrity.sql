-- Attendance integrity hardening
-- 1) Prevent more than one open-ended/current shift assignment for the
--    same employee in the same project.
-- 2) Keep historical assignments intact; no cascade deletes.

create unique index if not exists ux_employee_shifts_one_current_per_project
on hr.employee_shifts (employee_id, project_id)
where end_date is null;

-- Helpful read-only view for future server-side attendance DTO work.
create or replace view hr.attendance_details as
select
  a.attendance_id,
  a.employee_id,
  e.name as employee_name,
  e.job_title,
  e.department,
  a.project_id,
  p.name as project_name,
  a.shift_id,
  s.name as shift_name,
  a.date,
  a.check_in,
  a.check_out,
  a.status,
  a.late_minutes,
  a.worked_minutes,
  a.auto_closed,
  a.manual_modified,
  a.modified_by,
  a.modified_at,
  a.modification_reason,
  a.created_at,
  a.updated_at
from hr.attendance a
left join hr.employees e on e.employee_id = a.employee_id
left join hr.projects p on p.project_id = a.project_id
left join hr.shifts s on s.shift_id = a.shift_id;
