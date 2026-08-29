const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const core = fs.readFileSync(path.join(root, 'src/server/hr/core.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/server/hr/auth.ts'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/app/api/hr/route.ts'), 'utf8');

assert.ok(core.includes('SYSTEM_ADMIN'), 'SYSTEM_ADMIN missing');
assert.ok(core.includes('SECTOR_MANAGER'), 'SECTOR_MANAGER missing');
assert.ok(!core.includes('SITE_SUPERVISOR'), 'SITE_SUPERVISOR retired role still present');
assert.ok(auth.includes('elnuby_hr_session'), 'session cookie missing');
assert.ok(auth.includes('scrypt$'), 'scrypt missing');
assert.ok(!api.includes('body.token'), 'body token accepted');

const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
assert.ok(vercel.includes('/api/cron/auto-checkout'), 'Vercel must call the real auto-checkout route');
assert.ok(vercel.includes('"schedule": "0 0 * * *"'), 'Auto-checkout cron should run daily for Vercel Hobby');

assert.ok(core.includes('process.env.APP_TIMEZONE || "Africa/Cairo"'), 'Egypt deployment timezone must default to Cairo');
assert.ok(core.includes('status >= 500'), '5xx errors must be sanitized');
assert.ok(core.includes('normalizeTimeInput'), 'Time normalization helper missing');
assert.ok(core.includes('Africa/Cairo'), 'Egypt timezone must be used by server core');

const permission = fs.readFileSync(path.join(root, 'src/server/hr/permissions.ts'), 'utf8');
assert.ok(permission.includes('normalizeTimeInput(body.start_time)'), 'Permission start time must be normalized');
assert.ok(permission.includes('normalizeTimeInput(body.end_time)'), 'Permission end time must be normalized');
assert.ok(permission.includes('permission_type:'), 'Permission type must be persisted');
assert.ok(permission.includes('endMinutes <= startMinutes'), 'Overnight permission requests must be rejected explicitly');

const employees = fs.readFileSync(path.join(root, 'src/server/hr/employees.ts'), 'utf8');
assert.ok(employees.includes('session.user.role === "EMPLOYEE"'), 'Employee listing must be scoped to self');

const projects = fs.readFileSync(path.join(root, 'src/server/hr/projects.ts'), 'utf8');
assert.ok(projects.includes('getCurrentAssignment(session.user.employee_id || "")'), 'Employee project listing must be scoped to current assignment');

const shifts = fs.readFileSync(path.join(root, 'src/server/hr/shifts.ts'), 'utf8');
assert.ok(shifts.includes('from("employee_shifts")'), 'Employee shift listing must be scoped through employee assignments');

const users = fs.readFileSync(path.join(root, 'src/server/hr/users.ts'), 'utf8');
assert.ok(users.includes('leave_requests: "request_id"'), 'Admin leave request ID mapping must use request_id');
assert.ok(users.includes('permission_requests: "request_id"'), 'Admin permission ID mapping must use request_id');
assert.ok(users.includes('BLOCKED_ADMIN_FIELDS'), 'Generic admin CRUD must block internal fields');

const excel = fs.readFileSync(path.join(root, 'src/server/hr/excel.ts'), 'utf8');
assert.ok(excel.includes('key: "history_id"'), 'Excel residency-history key must match schema');

const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20260829_production_hardening.sql'), 'utf8');
const operational = fs.readFileSync(path.join(root, 'supabase/migrations/20260830_operational_hardening.sql'), 'utf8');
assert.ok(hardening.includes('prevent_permission_overlap'), 'DB must enforce concurrent permission overlap protection');
assert.ok(hardening.includes('prevent_leave_overlap'), 'DB must enforce concurrent leave overlap protection');
assert.ok(hardening.includes('prevent_duplicate_active_employee_user'), 'DB must enforce unique active employee accounts');
assert.ok(hardening.includes('pg_advisory_xact_lock'), 'Overlap protection must be concurrency-safe');
assert.ok(hardening.includes('permission_requests add column if not exists permission_type'), 'Permission type migration missing');
assert.ok(hardening.includes('attendance_minutes_nonnegative_chk'), 'Attendance integrity constraint missing');
assert.ok(!hardening.includes('attendance_checkin_checkout_order_chk'), 'Invalid direct TIME ordering constraint must not be used for overnight shifts');
assert.ok(operational.includes('check_in_accuracy_m'), 'GPS check-in accuracy must be persisted');
assert.ok(operational.includes('check_out_accuracy_m'), 'GPS check-out accuracy must be persisted');
const offline = fs.readFileSync(path.join(root, 'src/lib/offline.ts'), 'utf8');
assert.ok(offline.includes('userId: string'), 'Offline queue must be bound to a user');
assert.ok(offline.includes('Never delete pending attendance'), 'Offline queue must survive session expiry');
const apiClient = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
assert.ok(!apiClient.includes('clearOfflineData'), 'API client must never clear the offline queue on auth errors');
assert.ok(apiClient.includes('X-Offline-Sync'), 'Offline synchronization must be explicitly marked at transport level');
assert.ok(!apiClient.match(/clearOfflineData\(\)/), 'API client must not clear the offline queue on auth errors');
const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
assert.ok(page.includes('restoreCachedOfflineSession'), 'Refresh while offline must restore cached session');
assert.ok(page.includes('maximumAge: 0'), 'GPS must not reuse an old position');
assert.ok(page.includes('gps_accuracy_m'), 'GPS accuracy must be sent to backend');

console.log('PASS security contract + production hardening');
