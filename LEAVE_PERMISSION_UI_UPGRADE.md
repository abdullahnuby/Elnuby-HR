# Leave & Permission Approval UI Upgrade

Implemented a professional approval dialog workflow for leave and permission requests.

## Changes
- Removed browser `window.prompt()` from leave and permission approval/rejection.
- Added in-app review dialog with employee, type, dates/times, duration, project, reason, and current status/balance where available.
- Added explicit approval/rejection confirmation buttons.
- Rejection requires a minimum 3-character reason before submission.
- Added busy/disabled states and safe modal close behavior during requests.
- Preserved existing backend decision actions and authorization checks.
- Preserved cancellation workflow and existing request details modal.

## Verification
- Contract tests: PASS
- Backend smoke: PASS
- Security tests: PASS
- Operational regression: PASS
- Auth/offline regression: PASS
- Initial-load regression: PASS
- Leave/permission workflow regression: PASS
- No approval/rejection browser prompts remain in the two workflow components.

## Build note
A full `next build` could not be completed in the review environment because `npm ci` timed out. The Vercel build should be used as the final production TypeScript/build verification.
