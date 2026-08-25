# Supabase Production Changes

Project: ELNUBY HR

Applied migrations include:

- `canonical_hr_custom_auth_compatibility_v7`
- `p0_harden_hr_views_and_legacy_rls`
- `p1_canonical_fk_indexes`

The canonical HR data is now in schema `hr`.

The application uses:

- `hr.users`
- `hr.employees`
- `hr.projects`
- `hr.shifts`
- `hr.project_assignments`
- `hr.employee_shifts`
- `hr.project_managers`
- `hr.project_supervisors`
- `hr.attendance`
- `hr.leave_requests`
- `hr.permission_requests`
- `hr.leave_balances`
- `hr.deductions`
- `hr.audit_log`

`public.app_sessions` remains intentionally because it is server-only session storage.
Legacy public HR tables remain as compatibility data but are no longer used by the application code.

The browser is denied direct access to `hr` tables through RLS; the Next.js server uses the service-role key and enforces role/project scope before business operations.
