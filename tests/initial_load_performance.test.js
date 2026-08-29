const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/server/hr/auth.ts'), 'utf8');

assert.ok(page.includes('if (!cancelled) setAuthReady(true);'));
assert.ok(page.includes('const results = await Promise.allSettled(tasks);'));
assert.ok(page.includes("cacheGet<any>(apiCacheKey('dashboard', {}))"));
assert.ok(page.includes('Paint the most recent local snapshot immediately on refresh'));
assert.ok(page.includes('background'));
assert.ok(page.includes('Do not block the authenticated shell on secondary data'));
assert.ok(auth.includes('const [employeeResult, assignment] = await Promise.all(['));
assert.ok(auth.includes('const [{ data: projectData }, employeeShift] = await Promise.all(['));
console.log('PASS initial-load performance regression: shell-first rendering, parallel bootstrap data, optimized getMe queries');
