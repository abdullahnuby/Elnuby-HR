# ELNUBY HR — Egypt / Offline / GPS Deployment Notes

## Required before deployment

1. Apply `supabase/migrations/20260830_operational_hardening.sql` to the production Supabase database.
2. Set `APP_TIMEZONE=Africa/Cairo` in Vercel (the code also defaults to Egypt if it is absent).
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
4. Deploy the application after the migration is applied.

## Login / refresh behavior

- Session cookie is HTTP-only and persistent for 7 days.
- Server sessions use a sliding 7-day expiry on active use.
- Refresh while offline restores the last authenticated application state from a user-scoped local cache.
- A temporary network/server failure does not delete pending attendance records.

## Offline attendance

- Pending events are stored in IndexedDB and bound to the authenticated user ID.
- Synchronization starts only after the current authenticated user is restored.
- Check-in/check-out event IDs are idempotent and safe to replay after a lost response.
- Pending events survive session expiry and are retried after the same user signs in again.

## GPS

- Browser requests a fresh, high-accuracy location (`maximumAge=0`).
- Backend validates latitude/longitude ranges, GPS accuracy, project geofence, and event/GPS timestamps.
- Effective geofence acceptance requires `distance + accuracy <= radius` for a conservative boundary.

## Validation status

The repository regression suite passes: contract, backend smoke, security contract, and operational regression tests.
A full `next build` could not be completed in the review environment because npm dependency installation timed out; this remains a deployment-time verification item.
