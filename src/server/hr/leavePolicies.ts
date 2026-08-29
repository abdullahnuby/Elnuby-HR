import { supabase, success, errorResponse, generateId, nowISO, appDate, writeAuditLog } from "./core";
import type { SessionContext } from "./core";

const RESIDENCY = ["EXPATRIATE", "RESIDENT"];
const METHODS = ["ANNUAL", "PERIODIC", "MANUAL"];
const BASES = ["CALENDAR_DAYS", "WORKING_DAYS"];

export async function listLeavePolicies() {
  const { data, error } = await supabase
    .from("leave_policies")
    .select("*,leave_types(name)")
    .order("effective_from", { ascending: false })
    .order("name");
  if (error) return errorResponse("تعذر تحميل لوائح الإجازات", 500);
  return success(data || []);
}

export async function listEmployeeLeaveBalances(session: SessionContext, employeeId?: string) {
  const id = employeeId || session.user.employee_id;
  if (!id) return success([]);
  const { data: employee, error: employeeError } = await supabase.from("employees").select("employee_id,residency_type,hire_date").eq("employee_id", id).maybeSingle();
  if (employeeError) return errorResponse("تعذر تحميل بيانات الموظف",500);
  if (!employee) return errorResponse("الموظف غير موجود",404);
  const today = appDate();
  const residency = employee.residency_type || "RESIDENT";
  const { data: policies, error: policyError } = await supabase.from("leave_policies")
    .select("*,leave_types(name)")
    .eq("status","ACTIVE").or(`residency_type.eq.${residency},residency_type.is.null`)
    .lte("effective_from",today).or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("version",{ascending:false});
  if (policyError) return errorResponse("تعذر تحميل لوائح الإجازات",500);
  const result:any[]=[];
  for (const policy of policies || []) {
    if (!policy.leave_type_id || policy.accrual_method === "MANUAL") continue;
    const start = new Date(`${employee.hire_date || policy.effective_from}T00:00:00Z`);
    const current = new Date(`${today}T00:00:00Z`);
    const eligible = Math.max(0,Math.floor((current.getTime()-start.getTime())/86400000)+1);
    let entitlement = 0;
    let next = null;
    if (policy.accrual_method === "PERIODIC") {
      const period=Number(policy.accrual_period_days||0);
      const periods=period?Math.floor(eligible/period):0;
      entitlement=periods*Number(policy.accrual_days||0);
      if(period) next=new Date(start.getTime()+(periods+1)*period*86400000).toISOString().slice(0,10);
    } else {
      entitlement=Number(policy.annual_entitlement||0);
      next=`${Number(today.slice(0,4))+1}-01-01`;
    }
    const yearStart=`${today.slice(0,4)}-01-01`;
    const {data:requests}=await supabase.from("leave_requests").select("days,status,from_date").eq("employee_id",id).eq("leave_type_id",policy.leave_type_id).lte("from_date",today);
    let used=0,pending=0;
    for(const r of requests||[]){
      if(policy.accrual_method==="ANNUAL" && String(r.from_date)<yearStart) continue;
      if(r.status==="APPROVED") used+=Number(r.days||0); else if(["PENDING_MANAGER","PENDING_HR"].includes(r.status)) pending+=Number(r.days||0);
    }
    result.push({id:`LIVE-${id}-${policy.leave_type_id}`,employee_id:id,leave_type_id:policy.leave_type_id,year:Number(today.slice(0,4)),entitlement,used,pending,remaining:Math.max(0,entitlement-used-pending),next_accrual_date:next,leave_types:policy.leave_types,leave_policies:policy});
  }
  return success(result);
}

export async function createLeavePolicy(session: SessionContext, body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const leaveTypeId = String(body.leave_type_id || "").trim();
  const residency = body.residency_type ? String(body.residency_type) : null;
  const method = String(body.accrual_method || "ANNUAL");
  const basis = String(body.accrual_basis || "CALENDAR_DAYS");
  const effectiveFrom = String(body.effective_from || appDate());
  if (!name || !leaveTypeId) return errorResponse("اسم اللائحة ونوع الإجازة مطلوبان");
  if (residency && !RESIDENCY.includes(residency)) return errorResponse("نوع الإقامة غير صحيح");
  if (!METHODS.includes(method) || !BASES.includes(basis)) return errorResponse("طريقة احتساب اللائحة غير صحيحة");

  const periodRaw = body.accrual_period_days === "" || body.accrual_period_days == null ? null : Number(body.accrual_period_days);
  const period = periodRaw == null ? 0 : periodRaw;
  const accrualDays = Number(body.accrual_days || 0);
  const annual = Number(body.annual_entitlement || 0);
  if (method === "PERIODIC" && (!Number.isFinite(period) || period <= 0 || accrualDays <= 0)) {
    return errorResponse("اللائحة الدورية تحتاج عدد أيام الدورة وعدد أيام الإجازة المكتسبة");
  }
  if (method === "ANNUAL" && annual <= 0) return errorResponse("الاستحقاق السنوي يجب أن يكون أكبر من صفر");

  const { data, error } = await supabase.from("leave_policies").insert({
    policy_id: generateId("LP"),
    name,
    leave_type_id: leaveTypeId,
    residency_type: residency,
    accrual_method: method,
    accrual_basis: basis,
    accrual_period_days: period,
    accrual_days: accrualDays,
    annual_entitlement: annual,
    max_carryover_days: Number(body.max_carryover_days || 0),
    requires_document: Boolean(body.requires_document),
    allow_partial: Boolean(body.allow_partial),
    effective_from: effectiveFrom,
    effective_to: body.effective_to || null,
    version: Number(body.version || 1),
    status: String(body.status || "ACTIVE"),
    created_by: session.user.user_id,
    created_at: nowISO(),
    updated_at: nowISO(),
  }).select("*,leave_types(name)").single();
  if (error) return errorResponse(error.message, 500);
  await writeAuditLog(session.user.user_id, "create_leave_policy", "leave_policies", data.policy_id, data);
  return success(data, 201);
}

export async function updateLeavePolicy(session: SessionContext, body: Record<string, unknown>) {
  const id = String(body.policy_id || "").trim();
  if (!id) return errorResponse("رقم اللائحة مطلوب");
  const changes: Record<string, unknown> = {};
  for (const key of ["name","leave_type_id","residency_type","accrual_method","accrual_basis","accrual_period_days","accrual_days","annual_entitlement","max_carryover_days","requires_document","allow_partial","effective_from","effective_to","version","status"]) {
    if (body[key] !== undefined) changes[key] = body[key] === "" ? null : body[key];
  }
  if (!Object.keys(changes).length) return errorResponse("لا توجد بيانات للتعديل");
  if (changes.residency_type && !RESIDENCY.includes(String(changes.residency_type))) return errorResponse("نوع الإقامة غير صحيح");
  if (changes.accrual_method && !METHODS.includes(String(changes.accrual_method))) return errorResponse("طريقة الاستحقاق غير صحيحة");
  const { data, error } = await supabase.from("leave_policies").update({...changes,updated_at:nowISO()}).eq("policy_id", id).select("*,leave_types(name)").single();
  if (error) return errorResponse(error.message, 500);
  await writeAuditLog(session.user.user_id, "update_leave_policy", "leave_policies", id, {changes});
  return success(data);
}

export async function listLeaveTypes() {
  const { data, error } = await supabase.from("leave_types").select("*").order("name");
  if (error) return errorResponse("تعذر تحميل أنواع الإجازات", 500);
  return success(data || []);
}
