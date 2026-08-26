# ELNUBY HR — Role Policy Contract

## Final business rules

| Role | Attendance | Checkout | Scope |
|---|---:|---:|---|
| SYSTEM_ADMIN | Yes | Yes | Full system CRUD, users, security, settings, all data |
| HR_MANAGER | Yes | Yes | HR operations across the company |
| SECTOR_MANAGER | **No** | **No** | Assigned sectors/projects only |
| PROJECT_MANAGER | **Yes** | **Yes** | Assigned projects + employee/project operations |
| EMPLOYEE | Yes | Yes | Own attendance and self-service |

### Explicitly removed
`SITE_SUPERVISOR` is not a valid role and must not be offered by role selectors or accepted by role validation.

### Important distinction
A `PROJECT_MANAGER` remains a company employee. Project-manager privileges do not remove the employee attendance/checkout lifecycle.

A `SECTOR_MANAGER` is a managerial role only and has no attendance/checkout lifecycle.

### SYSTEM_ADMIN
The system administrator is the only unrestricted administrative role:
- create/update/delete employees
- create/update/delete projects and shifts
- manage assignments
- manage users and roles
- manage attendance/leave/permission/deduction records
- manage settings and security
- access all reports and system data

### Deployment note
The policy file is intentionally additive. Existing business logic should be wired to it at the authorization boundary rather than duplicating role rules across pages and API handlers.
