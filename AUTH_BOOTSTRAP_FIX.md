# Auth Bootstrap / Refresh Fix

## Root cause
The app's authenticated state (`me`) starts as `null` on every client mount. The page rendered the Login screen whenever `me` was null, while an asynchronous `/api/hr` `me` request was still restoring the existing server session.

On a normal refresh this produced a visible sequence:

1. React rendered the Login page because `me === null`.
2. The browser sent the existing HttpOnly session cookie.
3. `/api/hr` -> `me` validated the session.
4. `setMe(...)` ran.
5. The application rendered the dashboard again.

This was a login-screen flash, not an intentional logout.

## Fix
- Added `authReady` bootstrap state, initially `false`.
- While `authReady === false`, the Login form is not rendered; a session-verification screen is shown instead.
- `authReady` becomes `true` only after the initial authentication/bootstrap attempt finishes.
- Offline cached session restoration also marks auth bootstrap as ready.
- The normal Login form renders only when `authReady === true` and `me === null`.
- Explicit Logout behavior remains unchanged.

## Regression coverage
Added `tests/auth_refresh_ui_regression.test.js` and updated the operational regression expectation.

Verified:
- Auth refresh UI regression: PASS
- Contract: PASS
- Backend smoke: PASS
- Security: PASS
- Operational regression matrix: PASS
