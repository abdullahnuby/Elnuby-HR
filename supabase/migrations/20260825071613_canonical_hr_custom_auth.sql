-- Canonical ELNUBY HR schema + custom-auth compatibility.
-- Production was migrated from populated legacy public.* tables into hr.*.
-- This migration is idempotent for an existing ELNUBY database.

BEGIN;

DROP VIEW IF EXISTS hr.employee_shifts_view;
DROP VIEW IF EXISTS hr.project_assignments_view;
DROP VIEW IF EXISTS hr.employee_directory;

ALTER TABLE hr.attendance DROP CONSTRAINT IF EXISTS attendance_modified_by_fkey;
ALTER TABLE hr.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
ALTER TABLE hr.deductions DROP CONSTRAINT IF EXISTS deductions_created_by_fkey;
ALTER TABLE hr.employee_shifts DROP CONSTRAINT IF EXISTS employee_shifts_created_by_fkey;
ALTER TABLE hr.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_manager_id_fkey;
ALTER TABLE hr.permission_requests DROP CONSTRAINT IF EXISTS permission_requests_manager_id_fkey;
ALTER TABLE hr.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_created_by_fkey;
ALTER TABLE hr.project_managers DROP CONSTRAINT IF EXISTS project_managers_user_id_fkey;
ALTER TABLE hr.users DROP CONSTRAINT IF EXISTS users_id_fkey;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='hr' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS hr.project_supervisors (
  assignment_id text PRIMARY KEY,
  user_id text,
  project_id text NOT NULL REFERENCES hr.projects(project_id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hr.users ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE hr.project_managers ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE hr.attendance ALTER COLUMN modified_by TYPE text USING modified_by::text;
ALTER TABLE hr.audit_log ALTER COLUMN actor_user_id TYPE text USING actor_user_id::text;
ALTER TABLE hr.deductions ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE hr.employee_shifts ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE hr.leave_requests ALTER COLUMN manager_id TYPE text USING manager_id::text;
ALTER TABLE hr.permission_requests ALTER COLUMN manager_id TYPE text USING manager_id::text;
ALTER TABLE hr.project_assignments ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE hr.project_supervisors ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE hr.project_supervisors ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE hr.users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE hr.users ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_hr_project_supervisors_user ON hr.project_supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_project_supervisors_project ON hr.project_supervisors(project_id);

-- Business data migration from the populated legacy public schema.
INSERT INTO hr.employees (employee_id,name,job_title,department,phone,national_id,birth_date,hire_date,status,created_at,updated_at)
SELECT employee_id,name,job_title,department,phone,national_id,birth_date,hire_date,coalesce(status,'ACTIVE'),coalesce(created_at,now()),coalesce(updated_at,now())
FROM public.employees ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO hr.projects (project_id,name,client,location_name,latitude,longitude,geofence_radius_m,status,created_at,updated_at)
SELECT project_id,name,client,location_name,coalesce(latitude,0),coalesce(longitude,0),coalesce(geofence_radius_m,200),coalesce(status,'ACTIVE'),coalesce(created_at,now()),coalesce(updated_at,now())
FROM public.projects ON CONFLICT (project_id) DO NOTHING;

INSERT INTO hr.shifts (shift_id,name,start_time,attendance_open,attendance_close,checkout_open,checkout_close,auto_checkout_time,status,created_at)
SELECT shift_id,name,start_time,attendance_open,attendance_close,checkout_open,checkout_close,auto_checkout_time,coalesce(status,'ACTIVE'),coalesce(created_at,now())
FROM public.shifts ON CONFLICT (shift_id) DO NOTHING;

INSERT INTO hr.leave_types (leave_type_id,name,requires_balance,annual_entitlement,status)
SELECT leave_type_id,name,coalesce(requires_balance,false),coalesce(annual_entitlement,0),coalesce(status,'ACTIVE')
FROM public.leave_types ON CONFLICT (leave_type_id) DO NOTHING;

INSERT INTO hr.users (id,legacy_user_id,employee_id,username,role,status,last_login,failed_attempts,created_at,updated_at,password_hash,locked_until)
SELECT user_id,user_id,nullif(employee_id,''),username,coalesce(role,'EMPLOYEE'),coalesce(status,'ACTIVE'),last_login,coalesce(failed_attempts,0),coalesce(created_at,now()),coalesce(updated_at,now()),password_hash,locked_until
FROM public.users ON CONFLICT (id) DO NOTHING;

INSERT INTO hr.project_assignments (assignment_id,employee_id,project_id,start_date,end_date,is_current,created_by,created_at)
SELECT pa.assignment_id,pa.employee_id,pa.project_id,pa.start_date,pa.end_date,coalesce(pa.is_current,false),u.id,coalesce(pa.created_at,now())
FROM public.project_assignments pa
JOIN hr.employees e ON e.employee_id=pa.employee_id
JOIN hr.projects p ON p.project_id=pa.project_id
LEFT JOIN hr.users u ON u.legacy_user_id=pa.created_by
ON CONFLICT (assignment_id) DO NOTHING;

INSERT INTO hr.employee_shifts (assignment_id,employee_id,project_id,shift_id,start_date,end_date,created_by,created_at)
SELECT es.assignment_id,es.employee_id,es.project_id,es.shift_id,es.start_date,es.end_date,u.id,coalesce(es.created_at,now())
FROM public.employee_shifts es
JOIN hr.employees e ON e.employee_id=es.employee_id
JOIN hr.projects p ON p.project_id=es.project_id
JOIN hr.shifts s ON s.shift_id=es.shift_id
LEFT JOIN hr.users u ON u.legacy_user_id=es.created_by
ON CONFLICT (assignment_id) DO NOTHING;

INSERT INTO hr.project_managers (id,user_id,project_id,start_date,end_date,created_at)
SELECT pm.id,u.id,pm.project_id,coalesce(pm.start_date,current_date),pm.end_date,coalesce(pm.created_at,now())
FROM public.project_managers pm
JOIN hr.users u ON u.legacy_user_id=pm.user_id
JOIN hr.projects p ON p.project_id=pm.project_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr.project_supervisors (assignment_id,user_id,project_id,start_date,end_date,created_by,created_at)
SELECT ps.assignment_id,u.id,ps.project_id,ps.start_date,ps.end_date,cu.id,coalesce(ps.created_at,now())
FROM public.project_supervisors ps
JOIN hr.users u ON u.legacy_user_id=ps.user_id
JOIN hr.projects p ON p.project_id=ps.project_id
LEFT JOIN hr.users cu ON cu.legacy_user_id=ps.created_by
ON CONFLICT (assignment_id) DO NOTHING;

INSERT INTO hr.leave_balances (id,employee_id,leave_type_id,year,entitlement,used,pending,remaining,updated_at)
SELECT lb.id,lb.employee_id,lb.leave_type_id,lb.year,coalesce(lb.entitlement,0),coalesce(lb.used,0),coalesce(lb.pending,0),coalesce(lb.remaining,0),coalesce(lb.updated_at,now())
FROM public.leave_balances lb
JOIN hr.employees e ON e.employee_id=lb.employee_id
JOIN hr.leave_types lt ON lt.leave_type_id=lb.leave_type_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr.leave_requests (request_id,employee_id,project_id,leave_type_id,from_date,to_date,days,reason,status,manager_id,manager_decision_at,manager_comment,hr_decision,hr_decision_at,hr_comment,created_at,updated_at)
SELECT lr.request_id,lr.employee_id,lr.project_id,lr.leave_type_id,lr.from_date,lr.to_date,lr.days,lr.reason,coalesce(lr.status,'PENDING_MANAGER'),mu.id,lr.manager_decision_at,lr.manager_comment,lr.hr_decision,lr.hr_decision_at,lr.hr_comment,coalesce(lr.created_at,now()),coalesce(lr.updated_at,now())
FROM public.leave_requests lr
JOIN hr.employees e ON e.employee_id=lr.employee_id
JOIN hr.projects p ON p.project_id=lr.project_id
JOIN hr.leave_types lt ON lt.leave_type_id=lr.leave_type_id
LEFT JOIN hr.users mu ON mu.legacy_user_id=lr.manager_id
ON CONFLICT (request_id) DO NOTHING;

INSERT INTO hr.permission_requests (request_id,employee_id,project_id,date,start_time,end_time,minutes,reason,status,manager_id,manager_decision_at,manager_comment,created_at,updated_at)
SELECT pr.request_id,pr.employee_id,pr.project_id,pr.date,pr.start_time::time,pr.end_time::time,coalesce(pr.minutes,0),pr.reason,coalesce(pr.status,'PENDING'),mu.id,pr.manager_decision_at,pr.manager_comment,coalesce(pr.created_at,now()),coalesce(pr.updated_at,now())
FROM public.permission_requests pr
JOIN hr.employees e ON e.employee_id=pr.employee_id
JOIN hr.projects p ON p.project_id=pr.project_id
LEFT JOIN hr.users mu ON mu.legacy_user_id=pr.manager_id
ON CONFLICT (request_id) DO NOTHING;

INSERT INTO hr.deductions (deduction_id,employee_id,date,type,amount,reason,status,created_by,created_at)
SELECT d.deduction_id,d.employee_id,d.date,d.type,coalesce(d.amount,0),d.reason,coalesce(d.status,'ACTIVE'),u.id,coalesce(d.created_at,now())
FROM public.deductions d
JOIN hr.employees e ON e.employee_id=d.employee_id
LEFT JOIN hr.users u ON u.legacy_user_id=d.created_by
ON CONFLICT (deduction_id) DO NOTHING;

-- public.attendance historically contains a duplicate employee/date row; keep the most complete record.
INSERT INTO hr.attendance (attendance_id,employee_id,project_id,shift_id,date,check_in,check_in_lat,check_in_lng,check_in_distance_m,check_out,check_out_lat,check_out_lng,check_out_distance_m,status,late_minutes,worked_minutes,auto_closed,manual_modified,modified_by,modified_at,modification_reason,created_at,updated_at)
SELECT a.attendance_id,a.employee_id,a.project_id,a.shift_id,a.date,a.check_in,a.check_in_lat,a.check_in_lng,a.check_in_distance_m,a.check_out,a.check_out_lat,a.check_out_lng,a.check_out_distance_m,a.status,coalesce(a.late_minutes,0),a.worked_minutes,coalesce(a.auto_closed,false),coalesce(a.manual_modified,false),u.id,a.modified_at,a.modification_reason,coalesce(a.created_at,now()),coalesce(a.updated_at,a.created_at,now())
FROM (SELECT DISTINCT ON (employee_id,date) * FROM public.attendance ORDER BY employee_id,date,check_out DESC NULLS LAST,created_at DESC NULLS LAST) a
JOIN hr.employees e ON e.employee_id=a.employee_id
JOIN hr.projects p ON p.project_id=a.project_id
JOIN hr.shifts s ON s.shift_id=a.shift_id
LEFT JOIN hr.users u ON u.legacy_user_id=a.modified_by
ON CONFLICT (attendance_id) DO NOTHING;

INSERT INTO hr.audit_log (log_id,actor_user_id,action,entity,entity_id,old_value,new_value,reason,ip,created_at)
SELECT al.audit_id,u.id,al.action,coalesce(al.entity_type,'unknown'),al.entity_id,NULL,al.details,NULL,NULL,coalesce(al.created_at,now())
FROM public.audit_logs al LEFT JOIN hr.users u ON u.legacy_user_id=al.actor_user_id
ON CONFLICT (log_id) DO NOTHING;

DELETE FROM public.app_sessions;
DELETE FROM public.hr_app_sessions;

CREATE VIEW hr.project_assignments_view AS
SELECT pa.assignment_id,pa.employee_id,e.name employee_name,pa.project_id,p.name project_name,pa.start_date,pa.end_date,pa.is_current,
CASE WHEN pa.is_current AND pa.start_date<=CURRENT_DATE AND (pa.end_date IS NULL OR pa.end_date>=CURRENT_DATE) THEN 'CURRENT' ELSE 'HISTORY' END assignment_status,pa.created_by,pa.created_at
FROM hr.project_assignments pa JOIN hr.employees e ON e.employee_id=pa.employee_id JOIN hr.projects p ON p.project_id=pa.project_id;

CREATE VIEW hr.employee_shifts_view AS
SELECT es.assignment_id,es.employee_id,e.name employee_name,es.project_id,p.name project_name,es.shift_id,s.name shift_name,s.start_time,s.attendance_open,s.attendance_close,s.checkout_open,s.checkout_close,s.auto_checkout_time,es.start_date,es.end_date,
CASE WHEN es.start_date<=CURRENT_DATE AND (es.end_date IS NULL OR es.end_date>=CURRENT_DATE) THEN 'CURRENT' ELSE 'HISTORY' END status,es.created_by,es.created_at
FROM hr.employee_shifts es JOIN hr.employees e ON e.employee_id=es.employee_id JOIN hr.projects p ON p.project_id=es.project_id JOIN hr.shifts s ON s.shift_id=es.shift_id;

CREATE VIEW hr.employee_directory AS
SELECT e.employee_id,e.name,e.job_title,e.department,e.phone,e.status,pa.project_id current_project_id,p.name current_project_name,pa.start_date assignment_start,pa.end_date assignment_end,
CASE WHEN pa.assignment_id IS NULL THEN 'UNASSIGNED' ELSE 'CURRENT' END assignment_status,e.updated_at
FROM hr.employees e
LEFT JOIN LATERAL (SELECT x.assignment_id,x.project_id,x.start_date,x.end_date FROM hr.project_assignments x WHERE x.employee_id=e.employee_id AND x.is_current=true AND x.start_date<=CURRENT_DATE AND (x.end_date IS NULL OR x.end_date>=CURRENT_DATE) ORDER BY x.start_date DESC LIMIT 1) pa ON true
LEFT JOIN hr.projects p ON p.project_id=pa.project_id;

ALTER VIEW hr.project_assignments_view SET (security_invoker=true);
ALTER VIEW hr.employee_shifts_view SET (security_invoker=true);
ALTER VIEW hr.employee_directory SET (security_invoker=true);

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name tablename FROM information_schema.tables WHERE table_schema='hr' AND table_type='BASE TABLE' LOOP
    EXECUTE format('ALTER TABLE hr.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS deny_direct_client_access ON hr.%I',r.tablename);
    EXECUTE format('CREATE POLICY deny_direct_client_access ON hr.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_client_access ON public.audit_logs;
CREATE POLICY deny_direct_client_access ON public.audit_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_shift ON hr.attendance(shift_id);
CREATE INDEX IF NOT EXISTS idx_hr_deductions_employee ON hr.deductions(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_shifts_project ON hr.employee_shifts(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_shifts_shift ON hr.employee_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_leave_type ON hr.leave_balances(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_leave_type ON hr.leave_requests(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_hr_permission_requests_employee ON hr.permission_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_users_employee ON hr.users(employee_id);

COMMIT;
