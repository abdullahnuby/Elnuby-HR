# Final Auth / Refresh / Offline Fix

- Login now sets the persistent `elnuby_hr_session` cookie on the actual Login response.
- Session validation uses a server-side `public.app_sessions` record with a 7-day sliding expiry.
- The client retries a one-off 401 during hydration and does not treat transient auth/network failures as explicit logout.
- Offline cache supports the authenticated `user:<id>:` namespace and legacy anonymous cache migration.
- Offline attendance queue remains user-bound and is not deleted by auth/network failures.
- Vercel Hobby cron is once per day: `0 0 * * *`.
- Application timezone is `Africa/Cairo`.

Validation: contract, backend smoke, security, operational, auth/offline, and deep refresh regression tests pass.
`next build` was not executed in this environment because dependency installation timed out.
