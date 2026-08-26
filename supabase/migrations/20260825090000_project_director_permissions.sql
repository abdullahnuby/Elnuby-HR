-- Project Director / Sector Manager role and scoped project management.
BEGIN;

CREATE TABLE IF NOT EXISTS hr.sector_manager_projects (
  assignment_id text PRIMARY KEY,
  user_id text NOT NULL,
  project_id text NOT NULL REFERENCES hr.projects(project_id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_sector_manager_projects_user
  ON hr.sector_manager_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_sector_manager_projects_project
  ON hr.sector_manager_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_sector_manager_projects_active
  ON hr.sector_manager_projects(user_id, project_id, start_date, end_date);

ALTER TABLE hr.sector_manager_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_client_access ON hr.sector_manager_projects;
CREATE POLICY deny_direct_client_access
  ON hr.sector_manager_projects
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- The application enforces the role matrix server-side. This migration intentionally
-- does not add a CHECK constraint so future role expansion remains migration-safe.

COMMIT;
