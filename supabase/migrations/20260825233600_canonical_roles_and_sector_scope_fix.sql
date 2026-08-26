BEGIN;
ALTER TABLE hr.users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE hr.users SET role='SYSTEM_ADMIN' WHERE role='SUPER_ADMIN';
UPDATE hr.users SET role='SECTOR_MANAGER' WHERE role='PROJECT_DIRECTOR';
UPDATE hr.users SET role='EMPLOYEE' WHERE role='SITE_SUPERVISOR';
ALTER TABLE hr.users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['SYSTEM_ADMIN'::text,'HR_MANAGER'::text,'SECTOR_MANAGER'::text,'PROJECT_MANAGER'::text,'EMPLOYEE'::text]));
DO $$ BEGIN
 IF to_regclass('hr.sector_manager_projects') IS NULL THEN CREATE TABLE hr.sector_manager_projects(assignment_id text PRIMARY KEY,user_id text NOT NULL,project_id text NOT NULL REFERENCES hr.projects(project_id) ON DELETE CASCADE,start_date date NOT NULL,end_date date,created_by text,created_at timestamptz NOT NULL DEFAULT now());
 ELSE
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='sector_manager_projects' AND column_name='id') AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='sector_manager_projects' AND column_name='assignment_id') THEN ALTER TABLE hr.sector_manager_projects RENAME COLUMN id TO assignment_id; END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='sector_manager_projects' AND column_name='sector_manager_id') AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='hr' AND table_name='sector_manager_projects' AND column_name='user_id') THEN ALTER TABLE hr.sector_manager_projects RENAME COLUMN sector_manager_id TO user_id; END IF;
 END IF; END $$;
ALTER TABLE hr.sector_manager_projects ENABLE ROW LEVEL SECURITY;DROP POLICY IF EXISTS deny_direct_client_access ON hr.sector_manager_projects;CREATE POLICY deny_direct_client_access ON hr.sector_manager_projects FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE INDEX IF NOT EXISTS idx_hr_sector_manager_projects_user ON hr.sector_manager_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_sector_manager_projects_project ON hr.sector_manager_projects(project_id);
COMMIT;
