const fs=require('fs'),path=require('path'),assert=require('assert');const r=path.join(__dirname,'..');
for(const f of ['src/components/hr/AttendanceCalendar.tsx','src/components/hr/HRExecutiveDashboard.tsx','src/components/hr/ApprovalsCenter.tsx','supabase/migrations/20260830_approval_sla_and_calendar.sql']) assert.ok(fs.existsSync(path.join(r,f)),`${f} missing`);
const v=JSON.parse(fs.readFileSync(path.join(r,'vercel.json'),'utf8'));assert.equal(v.crons[0].schedule,'0 20 * * *');
assert.ok(fs.readFileSync(path.join(r,'src/server/hr/governance.ts'),'utf8').includes('processApprovalSla'));
assert.ok(fs.readFileSync(path.join(r,'src/server/hr/dashboard.ts'),'utf8').includes('getHRExecutiveDashboard'));
console.log('HR post-launch batch contract: PASS');
