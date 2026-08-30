const fs=require('fs'); const path=require('path'); const root=path.join(__dirname,'..');
const router=fs.readFileSync(path.join(root,'src/server/hr/router.ts'),'utf8');
const gov=fs.readFileSync(path.join(root,'src/server/hr/governance.ts'),'utf8');
if(!router.includes('case "approval_inbox"')||!router.includes('case "create_approval_request"')) throw new Error('governance routes missing');
if(!gov.includes('export async function approvalInbox')) throw new Error('approval inbox missing');
if(!gov.includes('لا يجوز اعتماد إجراء يخص مقدم الطلب نفسه')) throw new Error('conflict rule missing');
console.log('Governance Workflow Contract PASS');

if(!gov.includes('managedProjectIds.includes(String(r.project_id))')) throw new Error('approval inbox project scope missing');
if(!gov.includes('target_project_id',)) throw new Error('approval request project scope missing');
const core=fs.readFileSync(path.join(root,'src/server/hr/core.ts'),'utf8');
if(core.includes('errorResponse(\n      "Authentication required"')) throw new Error('English auth error leaked');
console.log('Governance Hardening Contract PASS');
