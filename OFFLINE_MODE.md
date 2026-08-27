# ELNUBY HR — Offline Mode

The application is now offline-first for workforce attendance.

## What works without internet

- The last successful employee/session/dashboard data is cached locally in IndexedDB.
- The application shell is cached by a Service Worker so a previously opened deployment can be opened offline.
- GPS attendance and checkout can be captured without internet.
- Offline check-in/check-out operations are stored locally in an ordered queue.
- A visible offline banner shows the connection state and pending attendance operations.
- When the connection returns, the queue is synchronized automatically and can also be synchronized manually.

## What still requires internet

- Login on a device with no cached authenticated profile.
- Creating/updating employees, projects, shifts and users.
- Leave approvals and other HR mutations.
- Excel import/export.
- Uploading medical documents.

## Important security behavior

Offline attendance is **provisional** until the server receives it. The server re-validates the employee session, project assignment, shift, geofence, attendance window and event timestamp during synchronization.

Offline timestamps are limited to events recorded no more than 7 days in the past and no more than 5 minutes in the future. Each check-in/check-out has a client event ID and database uniqueness constraint so retries cannot create duplicates.

## Device recommendation

Each site device should open the application while online at least once per day, log in, and keep the app installed/opened. This warms the Service Worker and local cache before entering a no-coverage area.
