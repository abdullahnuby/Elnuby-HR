import { supabase, success, errorResponse, generateId, nowISO, appDate, requireAuth, requireRole, writeAudit } from "./core";
import type { SessionContext } from "./core";

const ORG_ADMIN_ROLES = ["SYSTEM_ADMIN", "HR_MANAGER"] as const;

export async function listOrganizationUnits(session: SessionContext) {
  const auth = requireRole(session, ORG_ADMIN_ROLES);
  if (auth) return auth;
  const { data, error } = await supabase
    .from("organization_units")
    .select("*")
    .order("unit_type")
    .order("name");
  if (error) return errorResponse("تعذر تحميل الهيكل التنظيمي", 500);
  return success(data || []);
}

export async function createOrganizationUnit(session: SessionContext, body: Record<string, unknown>) {
  const auth = requireRole(session, ORG_ADMIN_ROLES);
  if (auth) return auth;
  const name = String(body.name || "").trim();
  const unitType = String(body.unit_type || "").trim();
  if (!name) return errorResponse("اسم الوحدة التنظيمية مطلوب");
  if (!["COMPANY","SECTOR","DEPARTMENT","SECTION"].includes(unitType)) return errorResponse("نوع الوحدة التنظيمية غير صحيح");
  const parentId = body.parent_unit_id ? String(body.parent_unit_id) : null;
  if (parentId) {
    const { data: parent } = await supabase.from("organization_units").select("unit_id,unit_type").eq("unit_id", parentId).maybeSingle();
    if (!parent) return errorResponse("الوحدة التنظيمية الأب غير موجودة");
    const allowed: Record<string,string[]> = { SECTOR:["COMPANY"], DEPARTMENT:["SECTOR"], SECTION:["DEPARTMENT"] };
    if (unitType !== "COMPANY" && !allowed[unitType]?.includes(parent.unit_type)) return errorResponse("تسلسل الهيكل التنظيمي غير صحيح");
  } else if (unitType !== "COMPANY") return errorResponse("يجب تحديد الوحدة التنظيمية الأب");
  const { data, error } = await supabase.from("organization_units").insert({
    unit_id: generateId("ORG"), name, unit_type: unitType, parent_unit_id: parentId,
    manager_user_id: body.manager_user_id ? String(body.manager_user_id) : null,
    active: true, created_by: session.user.user_id, created_at: nowISO(), updated_at: nowISO()
  }).select("*").single();
  if (error) return errorResponse(error.message, 500);
  await writeAudit(session.user.user_id, "create_organization_unit", "organization_units", String(data.unit_id), { after: data });
  return success(data, 201);
}

export async function updateOrganizationUnit(session: SessionContext, body: Record<string, unknown>) {
  const auth = requireRole(session, ORG_ADMIN_ROLES);
  if (auth) return auth;
  const unitId = String(body.unit_id || "").trim();
  if (!unitId) return errorResponse("معرف الوحدة التنظيمية مطلوب");
  const { data: before } = await supabase.from("organization_units").select("*").eq("unit_id", unitId).maybeSingle();
  if (!before) return errorResponse("الوحدة التنظيمية غير موجودة", 404);
  const changes: Record<string, unknown> = {};
  for (const key of ["name","parent_unit_id","manager_user_id","active"]) if (body[key] !== undefined) changes[key] = body[key] === "" ? null : body[key];
  if (changes.parent_unit_id === unitId) return errorResponse("لا يمكن جعل الوحدة أبًا لنفسها");
  const { data, error } = await supabase.from("organization_units").update({...changes, updated_at: nowISO()}).eq("unit_id", unitId).select("*").single();
  if (error) return errorResponse(error.message, 500);
  await writeAudit(session.user.user_id, "update_organization_unit", "organization_units", unitId, { before, after: data });
  return success(data);
}

export async function assignEmployeeOrganization(session: SessionContext, body: Record<string, unknown>) {
  const auth = requireRole(session, ORG_ADMIN_ROLES);
  if (auth) return auth;
  const employeeId = String(body.employee_id || "").trim();
  const unitId = String(body.unit_id || "").trim();
  const startDate = String(body.start_date || appDate());
  if (!employeeId || !unitId) return errorResponse("الموظف والوحدة التنظيمية مطلوبان");
  const [{ data: employee }, { data: unit }] = await Promise.all([
    supabase.from("employees").select("employee_id").eq("employee_id", employeeId).maybeSingle(),
    supabase.from("organization_units").select("unit_id,active").eq("unit_id", unitId).maybeSingle()
  ]);
  if (!employee) return errorResponse("الموظف غير موجود");
  if (!unit || !unit.active) return errorResponse("الوحدة التنظيمية غير موجودة أو غير نشطة");
  await supabase.from("employee_organization_history").update({ effective_to: startDate }).eq("employee_id", employeeId).is("effective_to", null);
  const { data, error } = await supabase.from("employee_organization_history").insert({
    assignment_id: generateId("EOH"), employee_id: employeeId, unit_id: unitId,
    effective_from: startDate, effective_to: null, created_by: session.user.user_id, created_at: nowISO()
  }).select("*").single();
  if (error) return errorResponse(error.message, 500);
  await writeAudit(session.user.user_id, "assign_employee_organization", "employee_organization_history", String(data.assignment_id), { after: data });
  return success(data, 201);
}

export async function employeeOrganizationHistory(session: SessionContext, body: Record<string, unknown>) {
  const auth = requireRole(session, ORG_ADMIN_ROLES);
  if (auth) return auth;
  const employeeId = String(body.employee_id || "").trim();
  if (!employeeId) return errorResponse("رقم الموظف مطلوب");
  const { data, error } = await supabase.from("employee_organization_history")
    .select("*, organization_units(*)").eq("employee_id", employeeId).order("effective_from", {ascending:false});
  if (error) return errorResponse("تعذر تحميل السجل التنظيمي", 500);
  return success(data || []);
}
