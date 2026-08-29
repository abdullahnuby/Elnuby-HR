# ELNUBY HR — Auth / Offline / GPS Deep Fix Report

## Root causes fixed

### 1. Refresh login loss
- Persistent HTTP-only session cookie now has both `maxAge` and `expires`.
- Cookie uses `SameSite=Lax` to avoid unnecessary browser/session edge cases while remaining CSRF-resistant for this same-origin application.
- `/api/hr` is explicitly dynamic (`force-dynamic`) with `revalidate=0` so auth status is never served from a stale cache.
- A passive `session_status` probe never clears the browser cookie by itself.
- Server-side session-store/database failures are treated as infrastructure failures rather than as an invalid session.

### 2. Offline `Load failed`
- Fixed cache-key mismatch: restore now reads the exact same `api:<action>:<payload>` keys that the API writes.
- Fixed identity ordering: `/me` establishes the user cache namespace before its response is cached.
- Offline restore now recovers `me`, dashboard, and manager dashboard from the user-scoped IndexedDB cache.
- The attendance queue remains separate from the cache and survives session expiry/network failures.

### 3. Offline synchronization
- Queue entries remain bound to the employee/user identity.
- Sync starts only after the authenticated identity is known.
- Failed sync increments attempts and stores the error without deleting the pending event.
- The same `client_event_id` is replayed for idempotent server processing.

### 4. GPS
- Fresh high-accuracy location requested with `maximumAge=0`.
- 20-second timeout.
- Accuracy and GPS timestamp are sent with each attendance event.
- Existing server-side coordinate/distance/accuracy checks remain active.

### 5. Egypt
- Application business timezone is `Africa/Cairo`.

## Verification executed

- Contract tests: PASS
- Backend smoke: PASS
- Security contract: PASS
- Operational regression matrix: PASS
- Auth/offline regression test: PASS
- TypeScript/TSX syntax transpile validation: PASS (40 files, 0 parse errors)
- Service worker JavaScript syntax: PASS

## Build caveat

A full `npm ci` could not be completed in the review environment because the package registry dependency download timed out; offline npm install also reported that `xlsx-republish@0.20.3` was not cached. Therefore a production `next build` was not falsely marked as verified here.

## Deployment note

After deploying this build, verify the browser Network tab for the login response and confirm `Set-Cookie: elnuby_hr_session=...` is present. Then refresh the application and confirm `/api/hr` `session_status` returns `authenticated: true`.
