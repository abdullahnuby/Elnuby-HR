# INITIAL LOAD PERFORMANCE FIX

## Root causes fixed
1. Initial `load()` fetched dashboard, manager dashboard, employees, projects, shifts and users sequentially.
2. A second `useEffect([me])` immediately fetched dashboard again after `load()` had already fetched it.
3. Offline sync called the full `load()` after a successful/failed sync, causing an unnecessary reload of all bootstrap data.
4. Initial application hydration and authentication remain separate from background synchronization.

## New behavior
- `/me` remains the single authentication bootstrap request.
- After identity is known, independent bootstrap requests are fetched with `Promise.allSettled()`.
- The UI can retain partial successful data if one secondary endpoint fails.
- The 15-second dashboard refresh remains as background refresh only; it no longer runs immediately after `me` is set.
- Offline sync refreshes only dashboard/manager dashboard after sync, not the complete application bootstrap.
- User identity is established before cache writes.

## Verification
- contract: PASS
- backend smoke: PASS
- security contract: PASS
- operational/auth/offline regressions: PASS
- TypeScript build could not be executed in this offline review environment because `node_modules` is not present.
