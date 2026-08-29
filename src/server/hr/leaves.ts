import { parsePagination } from "./core";
import { supabase, publicSupabase, success, errorResponse, generateId, nowISO, appDate, writeAudit } from "./core";
import type { SessionContext } from "./core";

const ACTIVE_PENDING = ["PENDING_MANAGER", "PENDING_HR"];

async function getEmployee(employeeId: string) {
  const { data, error } = await supabase.from("employees")
    .select("employee_id,name,job_title,department,hire_date,residency_type,status")
    .eq("employee_id", employeeId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getCurrentPolicy(employeeId: string, leaveTypeId: string, date: string) {
  const employee = await getEmployee(employeeId);
  if (!employee) return { employee: null, policy: null };
  const residency = employee.residency_type || "RESIDENT";
  const { data, error } = await supabase.from("leave_policies")
    .select("*,leave_types(name,requires_balance,annual_entitlement)")
    .eq("leave_type_id", leaveTypeId)
    .eq("status", "ACTIVE")
    .or(`residency_type.eq.${residency},residency_type.is.null`)
    .lte("effective_from", date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order("residency_type", { ascending: false })
    .order("version", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return { employee, policy: data };
}

function daysInclusive(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

async function requestTotals(employeeId: string, leaveTypeId: string, until: string) {
  const { data, error } = await supabase.from("leave_requests")
    .select("days,status,from_date,to_date")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .lte("from_date", until);
  if (error) throw error;
  let used = 0, pending = 0;
  for (const row of data || []) {
    const days = Number(row.days || 0);
    if (row.status === "APPROVED") used += days;
    else if (ACTIVE_PENDING.includes(row.status)) pending += days;
  }
  return { used, pending };
}

async function calculateBalance(employeeId: string, leaveTypeId: string, date: string) {
  const { employee, policy } = await getCurrentPolicy(employeeId, leaveTypeId, date);
  if (!employee || !policy) return null;
  if (policy.accrual_method === "MANUAL" || !policy.requires_balance && !policy.annual_entitlement && !policy.accrual_days) {
    return { employee, policy, entitlement: 0, used: 0, pending: 0, remaining: 0, eligible_days: 0, next_accrual_date: null };
  }

  const hireDate = employee.hire_date || policy.effective_from || date;
  const start = new Date(`${hireDate}T00:00:00Z`);
  const current = new Date(`${date}T00:00:00Z`);
  const eligibleDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86400000) + 1);
  let entitlement = 0;
  let nextAccrualDate: string | null = null;

  if (policy.accrual_method === "PERIODIC") {
    const period = Number(policy.accrual_period_days || 0);
    const earnedPeriods = period > 0 ? Math.floor(eligibleDays / period) : 0;
    entitlement = earnedPeriods * Number(policy.accrual_days || 0);
    if (period > 0) {
      const next = new Date(start.getTime() + (earnedPeriods + 1) * period * 86400000);
      nextAccrualDate = next.toISOString().slice(0, 10);
    }
  } else if (policy.accrual_method === "ANNUAL") {
    entitlement = Number(policy.annual_entitlement || 0);
    const yearStart = `${date.slice(0,4)}-01-01`;
    const { data: yearRows } = await supabase.from("leave_requests")
      .select("days,status").eq("employee_id", employeeId).eq("leave_type_id", leaveTypeId)
      .gte("from_date", yearStart).lte("from_date", date);
    let used = 0, pending = 0;
    for (const row of yearRows || []) {
      if (row.status === "APPROVED") used += Number(row.days || 0);
      else if (ACTIVE_PENDING.includes(row.status)) pending += Number(row.days || 0);
    }
    return { employee, policy, entitlement, used, pending, remaining: Math.max(0, entitlement-used-pending), eligible_days: eligibleDays, next_accrual_date: `${Number(date.slice(0,4))+1}-01-01` };
  }

  const totals = await requestTotals(employeeId, leaveTypeId, date);
  return {
    employee, policy, entitlement,
    used: totals.used, pending: totals.pending,
    remaining: Math.max(0, entitlement - totals.used - totals.pending),
    eligible_days: eligibleDays,
    next_accrual_date: nextAccrualDate,
  };
}

async function syncLegacyBalance(employeeId: string, leaveTypeId: string, year: number, balance: any) {
  const payload = {
    entitlement: balance?.entitlement || 0,
    used: balance?.used || 0,
    pending: balance?.pending || 0,
    remaining: balance?.remaining || 0,
    policy_id: balance?.policy?.policy_id || null,
    cycle_start: balance?.policy?.accrual_method === "ANNUAL" ? `${year}-01-01` : null,
    cycle_end: balance?.policy?.accrual_method === "ANNUAL" ? `${year}-12-31` : null,
    source: "POLICY",
    updated_at: nowISO(),
  };
  const { data: existing } = await supabase.from("leave_balances")
    .select("id").eq("employee_id", employeeId).eq("leave_type_id", leaveTypeId).eq("year", year).maybeSingle();
  if (existing) {
    await supabase.from("leave_balances").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("leave_balances").insert({
      id: generateId("BAL"), employee_id: employeeId, leave_type_id: leaveTypeId, year, ...payload,
    });
  }
}

export async function leaveList(session: SessionContext, body: Record<string, unknown> = {}) {
  const { from, to } = parsePagination(body, 100);
  let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).range(from, to);
  if (session.user.role === "EMPLOYEE") query = query.eq("employee_id", session.user.employee_id);
  if (["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(session.user.role)) {
    const { getManagedProjectIds } = await import("./core");
    const ids = await getManagedProjectIds(session.user);
    if (!ids.length) return success([]);
    query = query.in("project_id", ids);
  }
  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);
  const rows = data || [];
  const employeeIds = Array.from(new Set(rows.map((r:any)=>String(r.employee_id)).filter(Boolean)));
  const typeIds = Array.from(new Set(rows.map((r:any)=>String(r.leave_type_id)).filter(Boolean)));
  const [employeesResult, typesResult] = await Promise.all([
    employeeIds.length ? supabase.from("employees").select("employee_id,name,job_title,department,residency_type").in("employee_id", employeeIds) : Promise.resolve({data:[],error:null} as any),
    typeIds.length ? supabase.from("leave_types").select("*").in("leave_type_id", typeIds) : Promise.resolve({data:[],error:null} as any),
  ]);
  const em = new Map<string, any>((employeesResult.data || []).map((x: any) => [String(x.employee_id), x] as [string, any]));
  const tm = new Map<string, any>((typesResult.data || []).map((x: any) => [String(x.leave_type_id), x] as [string, any]));
  const enriched = [];
  for (const r of rows) {
    let balance = null;
    try { balance = await calculateBalance(r.employee_id, r.leave_type_id, String(r.from_date)); } catch {}
    enriched.push({
      ...r,
      employee_name: em.get(r.employee_id)?.name,
      employee_job_title: em.get(r.employee_id)?.job_title,
      employee_department: em.get(r.employee_id)?.department,
      residency_type: em.get(r.employee_id)?.residency_type,
      leave_type_name: tm.get(r.leave_type_id)?.name || r.leave_type_id,
      leave_balance: balance,
    });
  }
  return success(enriched);
}

export async function createLeave(session: SessionContext, body: Record<string, unknown>) {
  const employeeId = session.user.employee_id;
  if (!employeeId) return errorResponse("الحساب غير مرتبط بموظف");
  const { getCurrentAssignment } = await import("./core");
  const assignment = await getCurrentAssignment(employeeId);
  if (!assignment) return errorResponse("لا يوجد مشروع حالي للموظف");

  const fromDate = String(body.from_date || "");
  const toDate = String(body.to_date || "");
  const leaveTypeId = String(body.leave_type_id || "");
  if (!fromDate || !toDate || !leaveTypeId) return errorResponse("نوع الإجازة وتاريخ البداية والنهاية مطلوبون");
  if (fromDate > toDate) return errorResponse("تاريخ بداية الإجازة يجب أن يسبق تاريخ نهايتها");
  if (fromDate.slice(0,4) !== toDate.slice(0,4)) return errorResponse("لا يمكن إنشاء إجازة تمتد بين سنتين؛ أنشئ طلبًا منفصلًا لكل سنة.");
  const days = daysInclusive(fromDate, toDate);
  if (days < 1) return errorResponse("تواريخ الإجازة غير صحيحة");

  const { employee, policy } = await getCurrentPolicy(employeeId, leaveTypeId, fromDate);
  if (!employee) return errorResponse("الموظف غير موجود", 404);
  if (!policy) return errorResponse("لا توجد لائحة فعالة لهذا النوع من الإجازات ولفئة الموظف الحالية", 400);

  const document = (body as any).__document as any;
  const documentRequired = Boolean(policy.requires_document);
  if (documentRequired && (!document || typeof document.arrayBuffer !== "function")) {
    return errorResponse("هذا النوع من الإجازة يتطلب مستندًا مؤيدًا");
  }

  const balance = await calculateBalance(employeeId, leaveTypeId, fromDate);
  if (policy.accrual_method !== "MANUAL" && policy.leave_type_id && policy.accrual_method && balance && balance.remaining < days) {
    return errorResponse(`الرصيد المتاح غير كافٍ. المتبقي: ${balance.remaining} يوم.`);
  }

  const requestId = generateId("LV");
  const { data, error } = await supabase.from("leave_requests").insert({
    request_id: requestId,
    employee_id: employeeId,
    project_id: assignment.project_id,
    leave_type_id: leaveTypeId,
    policy_id: policy.policy_id,
    document_required: documentRequired,
    from_date: fromDate,
    to_date: toDate,
    days,
    reason: body.reason || null,
    status: "PENDING_MANAGER",
    created_at: nowISO(),
    updated_at: nowISO(),
  }).select("*").single();
  if (error) return errorResponse(error.message, 500);

  let uploadedPath: string | null = null;
  try {
    if (documentRequired) {
      const buffer = Buffer.from(await document.arrayBuffer());
      const maxBytes = 10 * 1024 * 1024;
      if (buffer.length > maxBytes) throw new Error("حجم المستند يتجاوز 10 ميجابايت");
      const allowed = ["application/pdf","image/jpeg","image/png","image/webp"];
      const mime = String(document.type || "");
      if (!allowed.includes(mime)) throw new Error("صيغة المستند يجب أن تكون PDF أو JPG أو PNG أو WEBP");
      const safeName = String(document.name || "medical-document").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0,100);
      const path = `${employeeId}/${requestId}-${safeName}`;
      uploadedPath = path;
      const upload = await publicSupabase.storage.from("hr-leave-documents").upload(path, buffer, {contentType:mime,upsert:false});
      if (upload.error) throw upload.error;
      const { error: docError } = await supabase.from("leave_request_documents").insert({
        document_id: generateId("DOC"), request_id: requestId, employee_id: employeeId,
        storage_path: path, file_name: String(document.name || safeName), mime_type: mime,
        file_size: buffer.length, uploaded_by: session.user.user_id, uploaded_at: nowISO(),
      });
      if (docError) throw docError;
    }
  } catch (documentError: any) {
    if (uploadedPath) await publicSupabase.storage.from("hr-leave-documents").remove([uploadedPath]);
    await supabase.from("leave_requests").delete().eq("request_id", requestId);
    return errorResponse(documentError?.message || "تعذر حفظ المستند الطبي", 400);
  }

  if (balance) {
    try { await syncLegacyBalance(employeeId, leaveTypeId, Number(fromDate.slice(0,4)), balance); } catch (e) { console.error("leave balance sync:", e); }
  }
  return success(data, 201);
}

export async function decideLeaveManager(session: SessionContext, body: Record<string, unknown>) {
  const requestId = String(body.request_id || "");
  const decision = String(body.decision || "").toUpperCase();
  if (!requestId || !["APPROVE","REJECT"].includes(decision)) return errorResponse("بيانات القرار غير صحيحة");
  const { data: request } = await supabase.from("leave_requests").select("*").eq("request_id", requestId).maybeSingle();
  if (!request) return errorResponse("طلب الإجازة غير موجود", 404);
  if (request.status !== "PENDING_MANAGER") return errorResponse("الطلب ليس في انتظار اعتماد مدير المشروع");
  const { canManageProject } = await import("./core");
  if (!(await canManageProject(session.user, request.project_id))) return errorResponse("الطلب غير تابع لمشروعك",403);
  const newStatus = decision === "APPROVE" ? "PENDING_HR" : "REJECTED";
  const { data,error } = await supabase.from("leave_requests").update({
    status:newStatus, manager_id:session.user.user_id, manager_decision_at:nowISO(),
    manager_comment:body.comment || null, updated_at:nowISO()
  }).eq("request_id",requestId).select("*").single();
  if (error) return errorResponse(error.message,500);
  try { const b=await calculateBalance(request.employee_id,request.leave_type_id,String(request.from_date)); if(b) await syncLegacyBalance(request.employee_id,request.leave_type_id,Number(String(request.from_date).slice(0,4)),b); } catch {}
  return success(data);
}

export async function decideLeaveHR(session: SessionContext, body: Record<string, unknown>) {
  const requestId = String(body.request_id || "");
  const decision = String(body.decision || "").toUpperCase();
  if (!requestId || !["APPROVE","REJECT"].includes(decision)) return errorResponse("بيانات القرار غير صحيحة");
  const { data: request } = await supabase.from("leave_requests").select("*").eq("request_id", requestId).maybeSingle();
  if (!request) return errorResponse("طلب الإجازة غير موجود",404);
  if (request.status !== "PENDING_HR") return errorResponse("الطلب ليس في انتظار اعتماد HR");
  const { data,error } = await supabase.from("leave_requests").update({
    status:decision==="APPROVE"?"APPROVED":"REJECTED", hr_decision:decision,
    hr_decision_at:nowISO(), hr_comment:body.comment || null, updated_at:nowISO()
  }).eq("request_id",requestId).select("*").single();
  if (error) return errorResponse(error.message,500);
  try { const b=await calculateBalance(request.employee_id,request.leave_type_id,String(request.from_date)); if(b) await syncLegacyBalance(request.employee_id,request.leave_type_id,Number(String(request.from_date).slice(0,4)),b); } catch {}
  return success(data);
}

export async function getLeaveDocument(session: SessionContext, body: Record<string, unknown>) {
  const requestId = String(body.request_id || "");
  if (!requestId) return errorResponse("رقم الطلب مطلوب");
  const { data: request } = await supabase.from("leave_requests").select("request_id,employee_id").eq("request_id",requestId).maybeSingle();
  if (!request) return errorResponse("طلب الإجازة غير موجود",404);
  if (!["SYSTEM_ADMIN","HR_MANAGER"].includes(session.user.role) && request.employee_id !== session.user.employee_id) return errorResponse("ليس لديك صلاحية عرض المستند",403);
  const { data: doc } = await supabase.from("leave_request_documents").select("*").eq("request_id",requestId).maybeSingle();
  if (!doc) return errorResponse("لا يوجد مستند لهذا الطلب",404);
  const { data: signed, error } = await publicSupabase.storage.from("hr-leave-documents").createSignedUrl(doc.storage_path, 300);
  if (error) return errorResponse("تعذر فتح المستند",500);
  return success({ ...doc, signed_url: signed?.signedUrl });
}
