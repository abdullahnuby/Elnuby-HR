BEGIN;
CREATE TABLE IF NOT EXISTS hr.organization_units (
  unit_id text PRIMARY KEY,
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('COMPANY','SECTOR','DEPARTMENT','SECTION')),
  parent_unit_id text REFERENCES hr.organization_units(unit_id) ON DELETE RESTRICT,
  manager_user_id text,
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hr.employee_organization_history (
  assignment_id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES hr.employees(employee_id) ON DELETE RESTRICT,
  unit_id text NOT NULL REFERENCES hr.organization_units(unit_id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  effective_to date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON hr.organization_units(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_org_units_type_active ON hr.organization_units(unit_type, active);
CREATE INDEX IF NOT EXISTS idx_employee_org_current ON hr.employee_organization_history(employee_id, effective_from DESC) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_org_unit ON hr.employee_organization_history(unit_id, effective_from DESC);
ALTER TABLE hr.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_organization_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_client_access ON hr.organization_units;
CREATE POLICY deny_direct_client_access ON hr.organization_units FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS deny_direct_client_access ON hr.employee_organization_history;
CREATE POLICY deny_direct_client_access ON hr.employee_organization_history FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
COMMIT;