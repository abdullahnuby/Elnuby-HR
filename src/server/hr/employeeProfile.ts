import { supabase, success, errorResponse, appDate, nowISO, generateId, requireRole } from './core';
import type { SessionContext } from './core';

const HR_ROLES = ['SYSTEM_ADMIN', 'HR_MANAGER'];

export async function getEmployeeProfile(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية عرض ملف الموظف', 403);
  const employeeId = String(body.employee_id || '').trim();
  if (!employeeId) return errorResponse('رقم الموظف مطلوب');

  const [{ data: employee, error: employeeError }, { data: assignments, error: assignmentError }, { data: shifts, error: shiftError }, { data: leaves, error: leaveError }, { data: permissions, error: permissionError }, { data: deductions, error: deductionError }, { data: cases, error: caseError }, { data: events, error: eventError }] = await Promise.all([
    supabase.from('employees').select('*').eq('employee_id', employeeId).maybeSingle(),
    supabase.from('project_assignments').select('assignment_id,project_id,start_date,end_date,is_current,projects(name,client)').eq('employee_id', employeeId).order('start_date', { ascending: false }),
    supabase.from('employee_shifts').select('assignment_id,project_id,shift_id,start_date,end_date,shifts(name,start_time,attendance_open,attendance_close,checkout_open,checkout_close,auto_checkout_time)').eq('employee_id', employeeId).order('start_date', { ascending: false }),
    supabase.from('leave_requests').select('request_id,leave_type_id,from_date,to_date,status,reason,created_at').eq('employee_id', employeeId).order('from_date', { ascending: false }).limit(100),
    supabase.from('permission_requests').select('request_id,permission_type,date,status,reason,created_at').eq('employee_id', employeeId).order('date', { ascending: false }).limit(100),
    supabase.from('deductions').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(100),
    supabase.from('disciplinary_cases').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(100),
    supabase.from('employment_events').select('*').eq('employee_id', employeeId).order('effective_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
  ]);

  if (employeeError) return errorResponse('تعذر تحميل ملف الموظف', 500);
  if (!employee) return errorResponse('الموظف غير موجود', 404);
  const first = [assignmentError, shiftError, leaveError, permissionError, deductionError, caseError, eventError].find(Boolean);
  if (first) {
    console.error('employee_profile:', first);
    return errorResponse('تعذر تحميل السجل الكامل للموظف', 500);
  }

  return success({
    employee,
    assignments: assignments || [],
    shifts: shifts || [],
    leaves: leaves || [],
    permissions: permissions || [],
    deductions: deductions || [],
    disciplinary_cases: cases || [],
    events: events || [],
    generated_at: nowISO(),
  });
}

export async function addEmploymentEvent(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية إضافة حدث وظيفي', 403);
  const employeeId = String(body.employee_id || '').trim();
  const eventType = String(body.event_type || '').trim();
  const title = String(body.title || '').trim();
  if (!employeeId || !eventType || !title) return errorResponse('الموظف ونوع الحدث والوصف مطلوبة');
  const effectiveDate = String(body.effective_date || appDate());
  const { data: employee } = await supabase.from('employees').select('employee_id').eq('employee_id', employeeId).maybeSingle();
  if (!employee) return errorResponse('الموظف غير موجود', 404);
  const { data, error } = await supabase.from('employment_events').insert({
    event_id: generateId('EEV'), employee_id: employeeId, event_type: eventType, title,
    description: body.description ? String(body.description) : null,
    effective_date: effectiveDate, metadata: body.metadata || {}, created_by: session.user.user_id, created_at: nowISO(),
  }).select('*').single();
  if (error) return errorResponse('تعذر حفظ الحدث الوظيفي', 500);
  return success(data, 201);
}

export async function listEmployeeContracts(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية عرض العقود', 403);
  const employeeId = String(body.employee_id || '').trim();
  if (!employeeId) return errorResponse('رقم الموظف مطلوب');
  const { data, error } = await supabase.from('employee_contracts').select('*').eq('employee_id', employeeId).order('start_date', { ascending: false });
  if (error) { console.error('employee_contracts:', error); return errorResponse('تعذر تحميل عقود الموظف', 500); }
  return success(data || []);
}

export async function createEmployeeContract(session: SessionContext, body: Record<string, unknown>) {
  if (!HR_ROLES.includes(session.user.role)) return errorResponse('ليس لديك صلاحية إضافة عقد', 403);
  const employeeId = String(body.employee_id || '').trim();
  const startDate = String(body.start_date || '').trim();
  if (!employeeId || !startDate) return errorResponse('الموظف وتاريخ بداية العقد مطلوبان');
  const endDate = body.end_date ? String(body.end_date) : null;
  if (endDate && endDate < startDate) return errorResponse('تاريخ نهاية العقد لا يمكن أن يسبق تاريخ بدايته');
  const { data, error } = await supabase.from('employee_contracts').insert({ contract_id: generateId('CTR'), employee_id: employeeId, contract_type: String(body.contract_type || 'PERMANENT'), start_date: startDate, end_date: endDate, status: String(body.status || 'ACTIVE'), notes: body.notes ? String(body.notes) : null, created_by: session.user.user_id, created_at: nowISO() }).select('*').single();
  if (error) { console.error('create contract:', error); return errorResponse('تعذر حفظ العقد', 500); }
  await addEmploymentEvent(session, { employee_id: employeeId, event_type: 'CONTRACT', title: 'إضافة عقد عمل', description: body.notes ? String(body.notes) : 'تم تسجيل عقد عمل', effective_date: startDate, metadata: { contract_id: data.contract_id, contract_type: data.contract_type, end_date: endDate } });
  return success(data, 201);
}
