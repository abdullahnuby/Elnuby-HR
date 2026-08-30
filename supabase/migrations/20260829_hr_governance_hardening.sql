-- ELNUBY HR: Governance hardening. Canonical HR schema only.
BEGIN;

CREATE TABLE IF NOT EXISTS hr.hr_approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  required_role text NOT NULL,
  scope_type text NOT NULL DEFAULT 'global',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr.hr_approval_requests (
  id text PRIMARY KEY,
  action_key text NOT NULL,
  target_employee_id text,
  target_project_id text,
  requested_by text,
  approver_id text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_approval_requests_status_ck CHECK (status IN ('pending','approved','rejected','cancelled'))
);

CREATE TABLE IF NOT EXISTS hr.hr_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  action_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr.hr_conflict_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  rule_key text NOT NULL UNIQUE,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_pending ON hr.hr_approval_requests(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_project ON hr.hr_approval_requests(target_project_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_employee ON hr.hr_approval_requests(target_employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_audit_log_entity ON hr.hr_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_audit_log_actor ON hr.hr_audit_log(actor_id, created_at DESC);

INSERT INTO hr.hr_approval_policies(action_key, required_role, scope_type) VALUES
 ('leave_approval','HR_MANAGER','global'),
 ('permission_approval','PROJECT_MANAGER','project'),
 ('disciplinary_decision','HR_MANAGER','global'),
 ('contract_approval','HR_MANAGER','global')
ON CONFLICT (action_key) DO UPDATE SET required_role=EXCLUDED.required_role, scope_type=EXCLUDED.scope_type, active=true;

INSERT INTO hr.hr_conflict_rules(action_key, rule_key, description) VALUES
 ('leave_approval','self_approval','لا يجوز للموظف اعتماد طلبه بنفسه'),
 ('permission_approval','self_approval','لا يجوز لمقدم الطلب اعتماد طلبه بنفسه'),
 ('disciplinary_decision','subject_approval','لا يجوز اعتماد إجراء يخص المعتمد نفسه'),
 ('contract_approval','self_approval','لا يجوز اعتماد عقد الموظف من صاحب العلاقة')
ON CONFLICT (rule_key) DO NOTHING;

ALTER TABLE hr.hr_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.hr_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.hr_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.hr_conflict_rules ENABLE ROW LEVEL SECURITY;

-- Service-role API access is intentionally used by the server. Deny direct browser access.
DROP POLICY IF EXISTS hr_governance_deny_client ON hr.hr_approval_policies;
CREATE POLICY hr_governance_deny_client ON hr.hr_approval_policies FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS hr_approval_requests_deny_client ON hr.hr_approval_requests;
CREATE POLICY hr_approval_requests_deny_client ON hr.hr_approval_requests FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS hr_audit_log_deny_client ON hr.hr_audit_log;
CREATE POLICY hr_audit_log_deny_client ON hr.hr_audit_log FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS hr_conflict_rules_deny_client ON hr.hr_conflict_rules;
CREATE POLICY hr_conflict_rules_deny_client ON hr.hr_conflict_rules FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

COMMIT;
