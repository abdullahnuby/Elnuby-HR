# ELNUBY HR — Post-launch Comprehensive Batch

Implemented in this batch:
- HR attendance calendar with company calendar awareness.
- Monthly reports aware of holidays/rest days.
- HR executive dashboard.
- Approval center with due dates and overdue state.
- Approval SLA policies, reminders, and escalation processing.
- Daily Vercel cron compatible with free-tier limits.
- Approval SLA processing integrated with the daily cron.
- Document expiry notifications coverage.
- Regression/contract coverage for the new batch.

Database migration applied to Supabase:
- 20260830_approval_sla_and_calendar

Validation performed:
- npm test: PASS
- Changed-file TypeScript parse: PASS
- ZIP integrity: PASS
