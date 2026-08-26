# ELNUBY HR - Attendance Engine Review

## Confirmed database findings

- Attendance data itself is not duplicated by `(employee_id, date)` in the current database.
- The screen was missing employee/project/shift names because the current attendance API returns `attendance.*` only.
- Current database rows can be joined cleanly through:
  - attendance.employee_id -> employees.employee_id
  - attendance.project_id -> projects.project_id
  - attendance.shift_id -> shifts.shift_id
- Project Manager attendance is allowed by the backend.
- Sector Manager is not allowed to clock in/out by the backend.
- The current active shift for the tested employees is `SHIFT-MORNING`.
- The older `SHIFT-3A84C4D0` is inactive and its historical assignments ended on 2026-08-23.
- Historical 02:xx attendance rows are real stored values; they are not duplicate rows. They should be treated as historical test/attendance data unless the business wants them corrected manually.

## Frontend fix

`DataSection.tsx` now enriches attendance rows from the employee/project/shift APIs and displays:

employee, job title, department, project, shift, date, check-in, check-out, delay, worked hours, status.

It also formats delay as hours/minutes instead of a raw number of minutes.

## Database hardening

The migration adds a unique partial index preventing two open-ended current shift assignments for the same employee/project while preserving historical assignments.

It also creates `hr.attendance_details` as a canonical read-only join view for the next backend refactor.

## Important next backend step

The final architecture should move the enrichment from the browser into `attendanceList()` and return a canonical Attendance DTO directly from the backend. The frontend fallback in this patch prevents broken displays while that backend refactor is completed.
