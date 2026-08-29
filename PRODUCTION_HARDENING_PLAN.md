# Production Hardening Plan

## P0 completed
- Fixed Vercel Cron route and changed schedule to hourly so auto-checkout is not missed.
- Default business timezone is `Africa/Cairo`; environment example updated.
- Fixed permission UI/backend mismatch: datetime-local values are converted to HH:MM and the date is validated.
- Added permission type storage.
- Employee data, projects, shifts, employee shifts, and deductions are scoped on the server for ordinary employees.
- Corrected admin primary-key mapping for leave balances/requests and permission requests.
- Corrected Excel residency-history key to `history_id`.
- Sanitized 5xx responses so database internals are not returned to clients.

## P1 completed
- Added database triggers with transaction-scoped advisory locks to prevent concurrent overlapping permission requests.
- Added database triggers with transaction-scoped advisory locks to prevent concurrent overlapping leave requests.
- Added attendance DB integrity checks for non-negative durations and valid checkout ordering.
- Hardened auto-checkout overnight-shift logic.
- Manual checkout now records worked minutes and audit metadata.
- Restricted raw admin CRUD from changing password/audit/decision/event internals.

## Remaining deployment actions
1. Apply `supabase/migrations/20260829_production_hardening.sql` to the production Supabase database.
2. Set `APP_TIMEZONE=Africa/Cairo` and a strong `CRON_SECRET` in Vercel.
3. Run `npm ci`, `npm run test`, and `npm run build` in CI/Vercel.
4. Perform real integration tests against a staging database for attendance, leave, permission, admin, offline sync, and cron.
