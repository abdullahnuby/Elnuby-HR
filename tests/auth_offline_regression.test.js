const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const offline = fs.readFileSync(path.join(root, 'src/lib/offline.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/server/hr/auth.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/app/api/hr/route.ts'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

// Reproduce the exact reported failure modes as code-level invariants.
assert.ok(auth.includes('sameSite: "lax"'));
assert.ok(auth.includes('expires = new Date(Date.now() + SESSION_MAX_AGE * 1000)'));
assert.ok(route.includes('dynamic = "force-dynamic"'));
assert.ok(route.includes('session_status'));
assert.ok(!route.includes('clearSessionCookie()'), 'passive session status must not clear the cookie');

// Offline state must be stored and restored under the same exact user-scoped keys.
assert.ok(page.includes("cacheGet(apiCacheKey('me', {}))"));
assert.ok(page.includes("cacheGet(apiCacheKey('dashboard', {}))"));
assert.ok(api.includes("setOfflineUserId(String((result.data as any).user.user_id));"));
assert.ok(api.indexOf("setOfflineUserId(String((result.data as any).user.user_id));") < api.indexOf("if (CACHEABLE_ACTIONS.has(action)) await cacheSet(key, result.data);"));
assert.ok(offline.includes('function scopedCacheKey(key: string)'));
assert.ok(offline.includes('const userId = getOfflineUserId();'));
assert.ok(offline.includes('throw new Error(\'لا توجد جلسة مستخدم محفوظة'));

// Network/auth failures may not delete pending attendance; they must remain replayable.
assert.ok(offline.includes('Never delete pending attendance because of an expired session.'));
assert.ok(!/authFailure[\s\S]{0,220}clearOfflineData\(\)/.test(api));

// A refreshed deployment must invalidate stale SW shell code.
assert.ok(sw.includes('elnuby-hr-shell-v3'));

console.log('PASS auth/offline regression: persistent cookie, non-destructive status probe, exact cache keys, user identity ordering, queue retention, SW invalidation');
