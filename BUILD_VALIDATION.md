# Build validation note

The project structure and TypeScript source were statically checked in the working environment. The environment did not have the npm dependency tarballs cached, and repeated `npm ci` attempts timed out, so a full `next build` could not be completed locally here.

Run `npm ci && npm run build` in CI/Vercel for the final production build verification.

## Canonical HR database
The application reads/writes business data through the `hr` Supabase schema.
The public business tables are legacy compatibility data and are no longer used by the application.
Sessions remain in `public.app_sessions` because they are server-only session storage.

## Authentication
The browser uses an HttpOnly `elnuby_hr_session` cookie. Do not restore `hr_token` in localStorage.

## Auto checkout
Vercel Hobby cron calls `/api/cron/auto-checkout` once daily for reconciliation. The attendance-list endpoint also runs the auto-checkout reconciliation, so records are closed at the configured `auto_checkout_time` when the attendance data is refreshed. `CRON_SECRET` is optional but recommended.
