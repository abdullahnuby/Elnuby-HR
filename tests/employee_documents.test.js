const fs=require('fs');
const root=require('path').join(__dirname,'..');
function read(p){return fs.readFileSync(root+'/'+p,'utf8')}
const router=read('src/server/hr/router.ts');
const docs=read('src/server/hr/documents.ts');
const route=read('src/app/api/hr/route.ts');
const migration=read('supabase-migration-20260901_employee_documents.sql');
for(const action of ['employee_documents','upload_employee_document','employee_document_url','delete_employee_document']) if(!router.includes(`case "${action}"`)) throw new Error(`missing ${action}`);
for(const x of ['employee_documents','employee_document_requirements','hr-employee-documents']) if(!migration.includes(x)) throw new Error(`missing ${x}`);
for(const x of ['10 * 1024 * 1024','application/pdf','image/jpeg','expiry_date','signed_url']) if(!docs.includes(x)) throw new Error(`missing validation ${x}`);
if(!route.includes('form.get("document")')) throw new Error('multipart document field missing');
console.log('Employee documents contract: PASS');
