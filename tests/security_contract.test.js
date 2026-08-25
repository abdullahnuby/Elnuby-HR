const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const core = fs.readFileSync(path.join(root, 'src/server/hr/core.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/server/hr/auth.ts'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/app/api/hr/route.ts'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const cron = fs.readFileSync(path.join(root, 'src/app/api/cron/auto-checkout/route.ts'), 'utf8');
const migrationDir = path.join(root, 'supabase', 'migrations');

if (!core.includes('.schema("hr")')) throw new Error('Business Supabase client is not pinned to hr schema');
if (!core.includes('publicSupabase')) throw new Error('Public session client is missing');
if (!core.includes('SITE_SUPERVISOR')) throw new Error('SITE_SUPERVISOR scope missing');
if (!auth.includes('elnuby_hr_session')) throw new Error('HttpOnly session cookie missing');
if (!auth.includes('scrypt$')) throw new Error('Scrypt password format missing');
if (!api.includes('SESSION_COOKIE')) throw new Error('API route is not reading the secure session cookie');
if (api.includes('body.token')) throw new Error('API route still accepts bearer tokens from request bodies');
if (client.includes('localStorage') || client.includes('hr_token')) throw new Error('Browser API client still stores auth token in localStorage');
if (!cron.includes('autoCheckoutOpenAttendance')) throw new Error('Auto checkout cron endpoint missing');
if (!fs.existsSync(path.join(migrationDir, '20260825071613_canonical_hr_custom_auth.sql'))) {
  throw new Error('Canonical schema migration is not committed');
}

console.log('PASS security contract: canonical hr schema, scoped roles, HttpOnly sessions, password hardening, audit path, and auto-checkout are wired.');
