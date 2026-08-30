BEGIN;
ALTER TABLE hr.employment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employment_events_service_access ON hr.employment_events;
DROP POLICY IF EXISTS employment_events_deny_client ON hr.employment_events;
CREATE POLICY employment_events_deny_client ON hr.employment_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
COMMIT;
