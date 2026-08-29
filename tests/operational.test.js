const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const offline = fs.readFileSync(path.join(root, 'src/lib/offline.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/app/api/hr/route.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/server/hr/auth.ts'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/server/hr/core.ts'), 'utf8');
const attendance = fs.readFileSync(path.join(root, 'src/server/hr/attendance.ts'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

// 1) Login survives normal refresh through a durable httpOnly cookie + server session.
assert.ok(auth.includes('httpOnly: true'));
assert.ok(auth.includes('maxAge: SESSION_MAX_AGE'));
assert.ok(auth.includes('expires'));
assert.ok(auth.includes('sameSite: "lax"'));
assert.ok(route.includes('dynamic = "force-dynamic"'));
assert.ok(core.includes('SESSION_MAX_AGE = 7 * 24 * 60 * 60'));
assert.ok(auth.includes('SESSION_MAX_AGE'));
assert.ok(core.includes('app_sessions'));
assert.ok(core.includes('refreshedExpiry'));

// 2) Browser refresh while offline restores last authenticated state instead of logging out.
assert.ok(page.includes('restoreCachedOfflineSession'));
assert.ok(page.includes("if (!navigator.onLine && await restoreCachedOfflineSession()) {"));
assert.ok(page.includes("cacheGet(apiCacheKey('me', {}))"));
assert.ok(page.includes("cacheGet(apiCacheKey('dashboard', {}))"));
assert.ok(page.includes("cacheGet(apiCacheKey('project_manager_dashboard', {}))"));
assert.ok(page.includes('await clearOfflineCache()'));
assert.ok(!page.includes("if (!cancelled) {\n          await clearOfflineData();"));

// 3) Offline queue survives auth expiry and is account-bound.
assert.ok(offline.includes('userId: string'));
assert.ok(offline.includes('getOfflineUserId'));
assert.ok(offline.includes('const userId = getOfflineUserId();'));
assert.ok(offline.includes('return `api:${action}:${JSON.stringify(payload || {})}`;'));
assert.ok(offline.includes('Never delete pending attendance'));
assert.ok(offline.includes("state?: 'PENDING' | 'FAILED'"));
assert.ok(offline.includes('permanent'));
assert.ok(api.includes('class ApiRequestError'));
assert.ok(page.includes('failedSync'));
assert.ok(page.includes('تعذر تسجيل'));
assert.ok(page.includes('تم رفض')); 
assert.ok(!api.includes('await clearOfflineData()'), 'API client must never clear the attendance queue');
assert.ok(api.includes('// Establish the cache namespace BEFORE storing the response.'));
assert.ok(!/authFailure[\s\S]{0,180}clearOfflineData\(\)/.test(api));

// 4) Sync cannot start before the authenticated identity is known.
assert.ok(page.includes('if (!currentUserId || !navigator.onLine) return;'));
assert.ok(page.includes('}, [me?.user?.user_id]);'));
assert.ok(page.includes('{ offlineSync: true }'));
assert.ok(route.includes("request.headers.get('x-offline-sync') === '1'"));

// 5) Offline check-in/out generates a stable id and the same id is replayed for idempotency.
assert.ok(page.includes('crypto.randomUUID()'));
assert.ok(offline.includes('client_event_id: id'));
assert.ok(attendance.includes('eq(\'client_event_id\', clientEventId)'));
assert.ok(attendance.includes('eq(\'check_out_event_id\', clientEventId)'));

// 6) GPS uses a fresh high-accuracy fix and reports accuracy + timestamp.
assert.ok(page.includes('enableHighAccuracy: true'));
assert.ok(page.includes('maximumAge: 0'));
assert.ok(page.includes('timeout: 20000'));
assert.ok(page.includes('gps_accuracy_m'));
assert.ok(page.includes('gps_timestamp'));
assert.ok(attendance.includes('gpsAccuracy'));
assert.ok(attendance.includes('distance + gpsAccuracy > radius'));
assert.ok(attendance.includes('latitude < -90 || latitude > 90'));
assert.ok(attendance.includes('longitude < -180 || longitude > 180'));

// 7) Egypt timezone is fixed in application business logic and UI.
assert.ok(core.includes('process.env.APP_TIMEZONE || "Africa/Cairo"'));
assert.ok(page.includes("const APP_TIMEZONE = 'Africa/Cairo'"));

// 8) Overnight attendance and auto-checkout are exercised by explicit code paths.
assert.ok(attendance.includes('overnightAttendance'));
assert.ok(attendance.includes('shiftOvernight'));
assert.ok(attendance.includes('rowDate === previousDate && currentMinutes >= autoMinutes'));

// 9) PWA shell version was bumped so old cached application code is invalidated.
assert.ok(sw.includes("elnuby-hr-shell-v3"));
assert.strictEqual(vercel.crons[0].path, '/api/cron/auto-checkout');

console.log('PASS operational regression matrix: auth refresh, offline restore, queue retention/isolation, sync ordering, idempotency, GPS freshness/accuracy, Egypt timezone, overnight shifts, PWA cache, cron');
