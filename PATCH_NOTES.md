# ELNUBY HR UI/UX + role-scope patch

This patch is based on the current `main` branch. Replace the matching files in the project.

Fixed:
- Employee leave screen now resolves the logged-in employee/project from `me` without requiring an employee-wide API call.
- Attendance screen uses the logged-in employee/project/shift as a fallback and has mobile card layout.
- Leave screen gets a proper mobile card layout and labeled date/reason inputs.
- Sector Manager no longer sees attendance/checkout actions; Project Manager remains a clock-in/out employee.
- Settings redesigned as a professional control-center with Overview, Attendance, Roles, and Operations tabs.
- Generic data tables get mobile-friendly cards instead of horizontal clipping.

Important: the uploaded ZIP supplied in this conversation contains only the attendance patch, not the complete repository. This archive is therefore a drop-in patch, not a standalone full repository.
