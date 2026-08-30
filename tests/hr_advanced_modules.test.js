const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
for(const f of ['src/server/hr/advanced.ts','src/components/hr/HRAdvanced.tsx','supabase/migrations/20260830_hr_advanced_modules.sql']){if(!fs.existsSync(path.join(root,f)))throw new Error('Missing '+f)}
const advanced=fs.readFileSync(path.join(root,'src/server/hr/advanced.ts'),'utf8');
for(const key of ['disciplinaryCases','trainingPrograms','recruitmentData','workforcePlan','payrollExportPreview'])if(!advanced.includes('export async function '+key))throw new Error('Missing '+key);
const page=fs.readFileSync(path.join(root,'src/app/page.tsx'),'utf8');
if(!page.includes("section === 'hr-advanced'"))throw new Error('HR advanced page not wired');
console.log('HR advanced module contract: PASS');
