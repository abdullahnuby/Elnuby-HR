const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
class Range{constructor(sh,r,c,nr,nc){this.sh=sh;this.r=r;this.c=c;this.nr=nr;this.nc=nc}setValues(v){for(let i=0;i<v.length;i++)for(let j=0;j<v[i].length;j++)this.sh.data[this.r-1+i][this.c-1+j]=v[i][j];return this}setValue(v){this.sh.data[this.r-1][this.c-1]=v;return this}clearContent(){for(let i=0;i<this.nr;i++)for(let j=0;j<this.nc;j++)this.sh.data[this.r-1+i][this.c-1+j]='';return this}setFontWeight(){return this}setWrap(){return this}createFilter(){return this}autoResizeColumns(){return this}}
class Sheet{constructor(name){this.name=name;this.data=[[]];this.frozen=0}getLastRow(){return this.data.length}getDataRange(){return {getValues:()=>this.data.map(r=>r.slice())}}getRange(r,c,nr=1,nc=1){while(this.data.length<r+nr-1)this.data.push([]);for(const row of this.data)while(row.length<c+nc-1)row.push('');return new Range(this,r,c,nr,nc)}setFrozenRows(n){this.frozen=n}autoResizeColumns(){}appendRow(row){if(this.data.length===1&&this.data[0].length===0)this.data[0]=row.map(()=> '');this.data.push(row.slice())}}
class SS{constructor(){this.sheets=new Map();this.url='mock://sheet'}getId(){return 'MOCK-SPREADSHEET-ID'}getSheetByName(n){return this.sheets.get(n)||null}insertSheet(n){const s=new Sheet(n);this.sheets.set(n,s);return s}setSpreadsheetTimeZone(){}getUrl(){return this.url}}
const ss=new SS(), props=new Map();
const Utilities={getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,s)=>Array.from(crypto.createHash('sha256').update(String(s)).digest()),computeHmacSha256Signature:(s,k)=>Array.from(crypto.createHmac('sha256',String(k)).update(String(s)).digest()),base64Encode:b=>Buffer.from(b).toString('base64'),base64EncodeWebSafe:s=>Buffer.from(String(s)).toString('base64url'),base64DecodeWebSafe:s=>Array.from(Buffer.from(String(s),'base64url')),newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString()}),formatDate:(d,tz,p)=>{const x=new Date(d);const pad=n=>String(n).padStart(2,'0');if(p==='yyyy-MM-dd')return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;if(p==='yyyy-MM-dd HH:mm:ss')return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`;if(p==='HH:mm')return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;if(p==='yyyy')return String(x.getUTCFullYear());return x.toISOString()}};
const PropertiesService={getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,String(v))})};
const SpreadsheetApp={getActiveSpreadsheet:()=>ss,openById:()=>ss}; const Session={getScriptTimeZone:()=> 'Africa/Cairo'};
const ContentService={MimeType:{JSON:'application/json'},createTextOutput:s=>({setMimeType:()=>({text:s})})};
const ScriptApp={getProjectTriggers:()=>[],newTrigger:()=>({timeBased:()=>({everyHours:()=>({create:()=>{}})})})};
const ctx={Utilities,PropertiesService,SpreadsheetApp,Session,ContentService,ScriptApp,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','apps-script','Code.gs'),'utf8'),ctx);
function req(action,body={}){const out=ctx.route(action,body);return out}
function ok(cond,msg){if(!cond)throw new Error('FAIL: '+msg);console.log('PASS:',msg)}
function expectErr(fn,msg){let hit=false;try{fn()}catch(e){hit=true}ok(hit,msg)}
ctx.setupDatabaseFromThisSheet();
// Make default shift permissive for deterministic tests.
const sh=ss.getSheetByName('SHIFTS'); sh.data[1][2]='00:00';sh.data[1][3]='00:00';sh.data[1][4]='23:59';sh.data[1][5]='00:00';sh.data[1][6]='23:59';sh.data[1][7]='23:59';
const admin=req('login',{username:'abdullah',password:'01095665256@As'}); ok(admin.token,'super admin login');
const A={token:admin.token};
const project=req('create_project',{...A,name:'Test Project',client:'Test Client',location_name:'Test Site',latitude:25.0999167,longitude:32.5674722,geofence_radius_m:500}); ok(project.project_id,'create project');
const emp=req('create_employee',{...A,name:'Employee One',job_title:'Site Engineer',department:'Civil',phone:'01000000000',national_id:'12345678901234',birth_date:'1990-01-01',hire_date:'2026-08-23',project_id:project.project_id,shift_id:sh.data[1][0]}); ok(emp.employee_id,'create employee with project+shift');
const emp2=req('create_employee',{...A,name:'Manager One',job_title:'Project Manager',department:'Management',hire_date:'2026-08-23',project_id:project.project_id,shift_id:sh.data[1][0]});
const pmUser=req('create_user',{...A,username:'pmtest',password:'Password123!',role:'PROJECT_MANAGER',employee_id:emp2.employee_id}); ok(pmUser.user_id,'create PM account');
req('assign_manager_project',{...A,user_id:pmUser.user_id,project_id:project.project_id});
const empUser=req('create_user',{...A,username:'emptest',password:'Password123!',role:'EMPLOYEE',employee_id:emp.employee_id}); ok(empUser.user_id,'create employee account');
const empLogin=req('login',{username:'emptest',password:'Password123!'}); const E={token:empLogin.token}; ok(req('me',E).employee.employee_id===emp.employee_id,'employee me');
const ctx1=req('employee_context',E); ok(ctx1.project.project_id===project.project_id && ctx1.shift.shift_id===sh.data[1][0],'employee project+shift context');
const ci=req('check_in',{...E,latitude:25.0999167,longitude:32.5674722}); ok(ci.check_in,'check in');
const co=req('check_out',{...E,latitude:25.0999167,longitude:32.5674722}); ok(co.check_out,'check out');
const att=req('attendance_list',E); ok(att.length===1 && att[0].check_out,'attendance list');
expectErr(()=>req('check_in',{...E,latitude:0,longitude:0}),'duplicate check-in rejected');
// Leave workflow
const lv=req('create_leave',{...E,leave_type_id:'LT-ANNUAL',from_date:'2026-08-24',to_date:'2026-08-25',reason:'Vacation'}); ok(lv.status==='PENDING_MANAGER','create leave');
const P={token:req('login',{username:'pmtest',password:'Password123!'}).token};
const lvm=req('decide_leave_manager',{...P,request_id:lv.request_id,decision:'APPROVE'}); ok(lvm.status==='PENDING_HR','manager leave approval');
const lvh=req('decide_leave_hr',{...A,request_id:lv.request_id,decision:'APPROVE'}); ok(lvh.status==='APPROVED','HR leave approval');
const bal=ctx.readRows(ctx.getSheet('LEAVE_BALANCES')).find(x=>x.employee_id===emp.employee_id&&x.leave_type_id==='LT-ANNUAL'); ok(Number(bal.used)===2 && Number(bal.pending)===0,'leave balance updated');
// Permission workflow
const pr=req('create_permission',{...E,date:'2026-08-23',start_time:'2026-08-23T10:00',end_time:'2026-08-23T12:30',reason:'Personal'}); ok(pr.minutes===150 && pr.start_time==='10:00' && pr.end_time==='12:30','create permission parses datetime-local');
const prd=req('decide_permission',{...P,request_id:pr.request_id,decision:'APPROVE'}); ok(prd.status==='APPROVED','permission approval');
// Admin attendance modification
const ar=att[0]; const upd=req('update_attendance',{...A,attendance_id:ar.attendance_id,check_out:'18:00',reason:'Correction'}); ok(upd.manual_modified===true,'attendance manual update');
// Access control
expectErr(()=>req('users',E),'employee cannot list users'); expectErr(()=>req('create_project',E),'employee cannot create project'); expectErr(()=>req('decide_leave_hr',{...P,request_id:lv.request_id,decision:'APPROVE'}),'PM cannot HR approve');
// Missing project/shift guards
const bad=ctx.readRows(ctx.getSheet('PROJECT_ASSIGNMENTS')).find(x=>x.employee_id===emp.employee_id); ctx.updateById('PROJECT_ASSIGNMENTS','assignment_id',bad.assignment_id,{is_current:'FALSE',end_date:'2026-08-23'}); expectErr(()=>req('check_in',{...E,latitude:25.0999167,longitude:32.5674722}),'check-in rejects missing active project');
console.log('ALL BACKEND TESTS PASSED');
