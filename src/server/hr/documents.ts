import { publicSupabase, supabase, success, errorResponse, generateId, nowISO, requireRole } from './core';
import type { SessionContext } from './core';

const HR_ROLES = ['SYSTEM_ADMIN','HR_MANAGER'];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf','image/jpeg','image/png','image/webp'];
const LABELS: Record<string,string> = {
  NATIONAL_ID:'بطاقة الرقم القومي', EMPLOYMENT_CONTRACT:'عقد العمل', QUALIFICATION:'المؤهل الدراسي',
  MEDICAL_FITNESS:'شهادة اللياقة الطبية', INSURANCE:'مستند التأمينات', PASSPORT:'جواز السفر',
  WORK_PERMIT:'تصريح العمل', OTHER:'مستند آخر'
};

export async function employeeDocuments(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية عرض مستندات الموظفين',403);
  const employeeId = String(body.employee_id || '').trim();
  if (!employeeId) return errorResponse('رقم الموظف مطلوب');
  const [{data: documents,error: docError},{data: requirements,error:reqError}] = await Promise.all([
    supabase.from('employee_documents').select('*').eq('employee_id',employeeId).order('expiry_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
    supabase.from('employee_document_requirements').select('*').eq('active',true).order('document_label')
  ]);
  if (docError || reqError) { console.error('employee_documents:',docError||reqError); return errorResponse('تعذر تحميل مستندات الموظف',500); }
  const today = new Date();
  const enriched = (documents||[]).map((d:any)=>({ ...d, document_label: LABELS[d.document_type] || d.document_name, computed_status: d.expiry_date && new Date(d.expiry_date+'T23:59:59') < today ? 'EXPIRED' : d.status }));
  return success({documents:enriched, requirements:requirements||[]});
}

export async function uploadEmployeeDocument(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية رفع مستندات الموظفين',403);
  const employeeId = String(body.employee_id||'').trim();
  const documentType = String(body.document_type||'OTHER').trim();
  const file = (body as any).__document;
  if (!employeeId || !file || typeof file.arrayBuffer !== 'function') return errorResponse('الموظف والملف مطلوبان');
  if (!ALLOWED.includes(String(file.type||''))) return errorResponse('صيغة المستند يجب أن تكون PDF أو JPG أو PNG أو WEBP',400);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) return errorResponse('حجم المستند يجب ألا يتجاوز 10 ميجابايت',400);
  const safeName = String(file.name||'document').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120) || 'document';
  const path = `${employeeId}/${generateId('DOC')}-${safeName}`;
  const upload = await publicSupabase.storage.from('hr-employee-documents').upload(path,buffer,{contentType:String(file.type),upsert:false});
  if (upload.error) { console.error('employee document upload:',upload.error); return errorResponse('تعذر رفع المستند',500); }
  try {
    const {data,error} = await supabase.from('employee_documents').insert({
      document_id:generateId('EDOC'), employee_id:employeeId, document_type:documentType,
      document_name:String(file.name||safeName), storage_path:path, mime_type:String(file.type), file_size:buffer.length,
      issue_date:body.issue_date?String(body.issue_date):null, expiry_date:body.expiry_date?String(body.expiry_date):null,
      status:'VALID', notes:body.notes?String(body.notes):null, uploaded_by:session.user.user_id, created_at:nowISO(), updated_at:nowISO()
    }).select('*').single();
    if (error) throw error;
    return success(data,201);
  } catch (e) {
    await publicSupabase.storage.from('hr-employee-documents').remove([path]);
    console.error('employee document insert:',e);
    return errorResponse('تعذر حفظ بيانات المستند',500);
  }
}

export async function documentsOverview(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية عرض مركز المستندات',403);
  const { data, error } = await supabase.from('employee_documents').select('document_id,employee_id,document_type,document_name,issue_date,expiry_date,status,notes,created_at').order('expiry_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(1000);
  if (error) return errorResponse('تعذر تحميل مركز المستندات',500);
  const employees = await supabase.from('employees').select('employee_id,name,job_title,department').in('employee_id',(data||[]).map((d:any)=>d.employee_id));
  if (employees.error) return errorResponse('تعذر تحميل بيانات الموظفين للمستندات',500);
  const em = new Map((employees.data||[]).map((e:any)=>[String(e.employee_id),e]));
  const now = Date.now();
  const enriched = (data||[]).map((d:any)=>{
    const days = d.expiry_date ? Math.ceil((new Date(`${d.expiry_date}T23:59:59`).getTime()-now)/86400000) : null;
    const computed_status = days !== null && days < 0 ? 'EXPIRED' : days !== null && days <= 30 ? 'EXPIRING' : d.status;
    return {...d, employee_name:em.get(String(d.employee_id))?.name || d.employee_id, job_title:em.get(String(d.employee_id))?.job_title, department:em.get(String(d.employee_id))?.department, days_to_expiry:days, computed_status};
  });
  return success({documents:enriched});
}

export async function employeeDocumentUrl(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية فتح المستند',403);
  const id = String(body.document_id||'').trim();
  if (!id) return errorResponse('رقم المستند مطلوب');
  const {data,error} = await supabase.from('employee_documents').select('storage_path,document_name,mime_type').eq('document_id',id).maybeSingle();
  if (error || !data) return errorResponse('المستند غير موجود',404);
  const {data:signed,error:signedError} = await publicSupabase.storage.from('hr-employee-documents').createSignedUrl(data.storage_path,300);
  if (signedError) return errorResponse('تعذر فتح المستند',500);
  return success({signed_url:signed?.signedUrl,document_name:data.document_name,mime_type:data.mime_type});
}

export async function deleteEmployeeDocument(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية حذف المستند',403);
  const id = String(body.document_id||'').trim();
  const {data,error} = await supabase.from('employee_documents').select('storage_path').eq('document_id',id).maybeSingle();
  if (error || !data) return errorResponse('المستند غير موجود',404);
  const removed = await publicSupabase.storage.from('hr-employee-documents').remove([data.storage_path]);
  if (removed.error) return errorResponse('تعذر حذف ملف المستند',500);
  const result = await supabase.from('employee_documents').delete().eq('document_id',id);
  if (result.error) return errorResponse('تعذر حذف بيانات المستند',500);
  return success({deleted:true});
}
