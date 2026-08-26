-- HR hardening
create unique index if not exists uq_hr_attendance_employee_date on hr.attendance(employee_id,date);
-- Enable after resolving existing duplicate ACTIVE accounts:
-- create unique index if not exists uq_hr_users_active_employee on hr.users(employee_id) where employee_id is not null and status='ACTIVE';
