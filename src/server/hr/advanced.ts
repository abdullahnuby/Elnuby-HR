import { supabase, success, errorResponse, generateId, nowISO, requireRole } from './core';
import type { SessionContext } from './core';

const HR_ROLES = ['SYSTEM_ADMIN', 'HR_MANAGER'] as const;
const MANAGEMENT_ROLES = ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER'] as const;

const allowedStatuses = {
  disciplinary: ['OPEN','UNDER_INVESTIGATION','DECIDED','CLOSED','CANCELLED'],
  candidate: ['NEW','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED'],
  position: ['OPEN','ON_HOLD','CLOSED'],
  training: ['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'],
};

function authHR(session: SessionContext) { return requireRole(session, HR_ROLES); }
function authManagement(session: SessionContext) { return requireRole(session, MANAGEMENT_ROLES); }
function text(v: unknown) { return String(v ?? '').trim(); }
function positiveInt(v: unknown, fallback = 0) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback; }

export async function disciplinaryCases(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  let q = supabase.from('disciplinary_cases').select('* , employees(name,employee_id,job_title), projects(name)').order('incident_date', { ascending: false }).limit(300);
  if (body.employee_id) q = q.eq('employee_id', text(body.employee_id));
  if (body.status && allowedStatuses.disciplinary.includes(text(body.status))) q = q.eq('status', text(body.status));
  const { data, error } = await q;
  if (error) return errorResponse('تعذر تحميل الجزاءات والحالات', 500);
  return success(data || []);
}

export async function createDisciplinaryCase(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const employeeId = text(body.employee_id), incidentDate = text(body.incident_date), description = text(body.description), category = text(body.category || 'OTHER');
  if (!employeeId || !incidentDate || !description) return errorResponse('الموظف والتاريخ ووصف الواقعة مطلوبة');
  const { data, error } = await supabase.from('disciplinary_cases').insert({
    case_id: generateId('DISC'), employee_id: employeeId, project_id: body.project_id ? text(body.project_id) : null,
    incident_date: incidentDate, category, description, status: 'OPEN', reported_by: session.user.user_id,
    hr_owner_id: session.user.user_id, created_at: nowISO(), updated_at: nowISO()
  }).select('*').single();
  if (error) return errorResponse('تعذر إنشاء الحالة التأديبية', 500);
  return success(data, 201);
}

export async function decideDisciplinaryCase(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const caseId = text(body.case_id), decision = text(body.status);
  if (!caseId || !allowedStatuses.disciplinary.includes(decision) || !['DECIDED','CLOSED','CANCELLED','UNDER_INVESTIGATION'].includes(decision)) return errorResponse('بيانات القرار غير صحيحة');
  const { data, error } = await supabase.from('disciplinary_cases').update({ status: decision, resolution: body.resolution ? text(body.resolution) : null, decided_at: ['DECIDED','CLOSED'].includes(decision) ? nowISO() : null, closed_at: decision === 'CLOSED' ? nowISO() : null, updated_at: nowISO() }).eq('case_id', caseId).select('*').single();
  if (error) return errorResponse('تعذر تحديث الحالة التأديبية', 500);
  return success(data);
}

export async function trainingPrograms(session: SessionContext, body: Record<string, unknown>) {
  const auth = authManagement(session); if (auth) return auth;
  let q = supabase.from('training_programs').select('*').order('start_date',{ascending:false}).limit(300);
  if (body.status && allowedStatuses.training.includes(text(body.status))) q=q.eq('status',text(body.status));
  const {data,error}=await q;
  if(error) return errorResponse('تعذر تحميل برامج التدريب',500);
  return success(data||[]);
}

export async function createTrainingProgram(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const name=text(body.name), start=text(body.start_date);
  if(!name||!start) return errorResponse('اسم البرنامج وتاريخ البداية مطلوبان');
  const {data,error}=await supabase.from('training_programs').insert({program_id:generateId('TRN'),name,provider:body.provider?text(body.provider):null,start_date:start,end_date:body.end_date?text(body.end_date):null,budget:body.budget?Number(body.budget):0,target_roles:body.target_roles?text(body.target_roles):null,status:text(body.status||'PLANNED'),created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error)return errorResponse('تعذر إنشاء برنامج التدريب',500);
  return success(data,201);
}

export async function assignTraining(session: SessionContext, body: Record<string, unknown>) {
  const auth = authManagement(session); if (auth) return auth;
  const programId=text(body.program_id), employeeId=text(body.employee_id);
  if(!programId||!employeeId)return errorResponse('البرنامج والموظف مطلوبان');
  const {data,error}=await supabase.from('employee_training').upsert({assignment_id:generateId('ETR'),program_id:programId,employee_id:employeeId,status:'ASSIGNED',progress:0,assigned_by:session.user.user_id,assigned_at:nowISO(),updated_at:nowISO()},{onConflict:'program_id,employee_id'}).select('*').single();
  if(error)return errorResponse('تعذر إسناد البرنامج للموظف',500);
  return success(data,201);
}

export async function recruitmentData(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const [positions,candidates] = await Promise.all([
    supabase.from('recruitment_positions').select('*').order('created_at',{ascending:false}).limit(300),
    supabase.from('recruitment_candidates').select('*').order('created_at',{ascending:false}).limit(500),
  ]);
  if(positions.error||candidates.error)return errorResponse('تعذر تحميل بيانات التوظيف',500);
  return success({positions:positions.data||[],candidates:candidates.data||[]});
}

export async function createPosition(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const title=text(body.title), count=positiveInt(body.headcount,1);
  if(!title||count<1)return errorResponse('المسمى الوظيفي وعدد الشواغر مطلوبان');
  const {data,error}=await supabase.from('recruitment_positions').insert({position_id:generateId('POS'),title,department:body.department?text(body.department):null,project_id:body.project_id?text(body.project_id):null,headcount:count,filled_count:0,priority:text(body.priority||'NORMAL'),status:text(body.status||'OPEN'),opened_at:body.opened_at?text(body.opened_at):new Date().toISOString().slice(0,10),notes:body.notes?text(body.notes):null,created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error)return errorResponse('تعذر إنشاء طلب التوظيف',500);
  return success(data,201);
}

export async function addCandidate(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const positionId=text(body.position_id), name=text(body.name), phone=text(body.phone);
  if(!positionId||!name||!phone)return errorResponse('الشاغر واسم المرشح والهاتف مطلوبة');
  const {data,error}=await supabase.from('recruitment_candidates').insert({candidate_id:generateId('CAN'),position_id:positionId,name,phone,email:body.email?text(body.email):null,source:body.source?text(body.source):null,status:'NEW',score:body.score?Number(body.score):null,notes:body.notes?text(body.notes):null,created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error)return errorResponse('تعذر إضافة المرشح',500);
  return success(data,201);
}

export async function updateCandidate(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const candidateId=text(body.candidate_id), status=text(body.status);
  if(!candidateId||!allowedStatuses.candidate.includes(status))return errorResponse('بيانات المرشح غير صحيحة');
  const patch:any={status,updated_at:nowISO()};
  for(const k of ['score','notes','interview_date']) if(body[k]!==undefined) patch[k]=body[k]===null?null:body[k];
  const {data,error}=await supabase.from('recruitment_candidates').update(patch).eq('candidate_id',candidateId).select('*').single();
  if(error)return errorResponse('تعذر تحديث المرشح',500);
  return success(data);
}

export async function workforcePlan(session: SessionContext, body: Record<string, unknown>) {
  const auth = authManagement(session); if (auth) return auth;
  let q=supabase.from('workforce_plans').select('*').order('period_start',{ascending:false}).limit(200);
  if(body.department)q=q.eq('department',text(body.department));
  if(body.project_id)q=q.eq('project_id',text(body.project_id));
  const {data,error}=await q;
  if(error)return errorResponse('تعذر تحميل خطط القوى العاملة',500);
  return success(data||[]);
}

export async function createWorkforcePlan(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const period=text(body.period_start), title=text(body.title);
  if(!period||!title)return errorResponse('عنوان الخطة وتاريخ البداية مطلوبان');
  const {data,error}=await supabase.from('workforce_plans').insert({plan_id:generateId('WFP'),title,department:body.department?text(body.department):null,project_id:body.project_id?text(body.project_id):null,period_start:period,period_end:body.period_end?text(body.period_end):null,current_headcount:positiveInt(body.current_headcount),required_headcount:positiveInt(body.required_headcount),critical_roles:body.critical_roles?text(body.critical_roles):null,actions:body.actions?text(body.actions):null,status:text(body.status||'DRAFT'),created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error)return errorResponse('تعذر حفظ خطة القوى العاملة',500);
  return success(data,201);
}

export async function payrollExportPreview(session: SessionContext, body: Record<string, unknown>) {
  const auth = authHR(session); if (auth) return auth;
  const start=text(body.start_date), end=text(body.end_date);
  if(!start||!end||end<start)return errorResponse('فترة الرواتب غير صحيحة');
  const [employees, attendance, deductions, leaves] = await Promise.all([
    supabase.from('employees').select('employee_id,name,job_title,department,status').eq('status','ACTIVE').order('name'),
    supabase.from('attendance').select('employee_id,date,check_in,check_out,late_minutes,worked_minutes,status').gte('date',start).lte('date',end),
    supabase.from('deductions').select('employee_id,date,type,amount,reason,status').gte('date',start).lte('date',end).eq('status','ACTIVE'),
    supabase.from('leave_requests').select('employee_id,from_date,to_date,days,status,leave_type_id').eq('status','APPROVED').lte('from_date',end).gte('to_date',start),
  ]);
  if(employees.error||attendance.error||deductions.error||leaves.error)return errorResponse('تعذر تجهيز ملخص تكامل الرواتب',500);
  const attMap=new Map<string,any[]>(); for(const r of attendance.data||[]){const arr=attMap.get(r.employee_id)||[];arr.push(r);attMap.set(r.employee_id,arr)}
  const dedMap=new Map<string,number>(); for(const r of deductions.data||[])dedMap.set(r.employee_id,(dedMap.get(r.employee_id)||0)+Number(r.amount||0));
  const rows=(employees.data||[]).map((e:any)=>{const a=attMap.get(e.employee_id)||[];return {employee_id:e.employee_id,name:e.name,department:e.department,days_present:a.filter(x=>x.status==='PRESENT'||x.status==='LATE').length,late_minutes:a.reduce((s,x)=>s+Number(x.late_minutes||0),0),worked_minutes:a.reduce((s,x)=>s+Number(x.worked_minutes||0),0),approved_leave_days:(leaves.data||[]).filter((l:any)=>l.employee_id===e.employee_id).reduce((s:any,x:any)=>s+Number(x.days||0),0),deductions:Number(dedMap.get(e.employee_id)||0)}});
  return success({period:{start,end},rows,generated_at:nowISO(),note:'هذا ملخص تكامل فقط ولا يحسب صافي الراتب أو التأمينات أو الضرائب.'});
}
