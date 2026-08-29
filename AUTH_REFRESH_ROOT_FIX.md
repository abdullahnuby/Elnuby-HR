# Auth Refresh Root Fix

## Problem
A page refresh could show the login screen because the browser bootstrap depended on a passive `session_status` probe and treated a single negative/transient auth response as logout. The client API also cleared cached data on a single 401, which made offline recovery worse.

## Fix
- Page bootstrap now calls the protected `me` endpoint directly as the source of truth.
- A transient auth-store/server response gets one controlled retry before logout.
- A 503/session-store failure is never interpreted as logout.
- Client API no longer clears cached application data on a single 401.
- Explicit logout and successful account switching still clear local cached views intentionally.
- The server re-issues the same valid HttpOnly session cookie on authenticated requests to keep cookie expiry sliding.
- Session-store/database errors are distinguished from an actually missing/expired session.
- Offline cached state remains available for degraded-network startup.

## Verification
Passed:
- contract tests
- backend smoke tests
- security contract tests
- operational regression matrix
- auth/offline regression tests
- TypeScript/TSX source parsing performed during hardening review

The production Next.js build was not executed in this environment because `node_modules` is not present in the supplied ZIP and dependency installation was not completed here.
