# Offline Sync Result Fix

## What was fixed
- Offline check-in/check-out operations are no longer reported as simply "synced" when the server rejects them.
- HTTP 400/403/409/422 responses are treated as permanent business/security failures and the queue item is marked `FAILED` instead of being retried forever.
- Transient/network/authentication failures remain `PENDING` and are retained for a later authenticated sync.
- The UI now reports the exact server rejection reason after connectivity returns, for example: `الانصراف غير متاح في هذا الوقت`.
- After a permanent rejection, the UI reloads server state so optimistic offline data is not left looking like a successful attendance record.
- A failed-operation counter is shown separately from pending operations.

## Example
If an employee records checkout offline before `checkout_open`, the device stores the event locally. When internet returns, the server evaluates the original client timestamp, rejects the checkout with the business rule, and the application displays the rejection reason rather than a misleading synchronization success.

## Verification
- contract tests: PASS
- backend smoke: PASS
- security contract: PASS
- operational regression matrix: PASS
- auth/offline regression: PASS
