import { supabase, success, errorResponse, generateId, nowISO, getManagedProjectIds } from "./core";
import type { SessionContext } from "./core";

const APPROVAL_ROLES: Record<string, string[]> = {
  leave_approval: ["SYSTEM_ADMIN", "HR_MANAGER"],
  permission_approval: ["SYSTEM_ADMIN", "HR_MANAGER", "PROJECT_MANAGER", "SECTOR_MANAGER"],
  disciplinary_decision: ["SYSTEM_ADMIN", "HR_MANAGER"],
  contract_approval: ["SYSTEM_ADMIN", "HR_MANAGER"],
};


export async function startApprovalWorkflow(
  actionKey: string,
  requestId: string,
  targetEmployeeId: string | null,
  targetProjectId: string | null,
) {
  const steps = actionKey === "leave_approval"
    ? ["PROJECT_MANAGER", "HR_MANAGER"]
    : actionKey === "permission_approval"
      ? ["PROJECT_MANAGER"]
      : ["HR_MANAGER"];

  const rows = steps.map((role, index) => ({
    action_key: actionKey,
    request_id: requestId,
    step_no: index + 1,
    approver_role: role,
    status: index === 0 ? "pending" : "waiting",
    created_at: nowISO(),
  }));

  const { error } = await supabase.from("approval_workflows").insert(rows);
  if (error) throw error;

  const { error: legacyError } = await supabase.from("hr_approval_requests").insert({
    id: generateId("APR"),
    action_key: actionKey,
    target_employee_id: targetEmployeeId,
    target_project_id: targetProjectId,
    requested_by: null,
    status: "pending",
    created_at: nowISO(),
  });
  if (legacyError) {
    console.error("approval legacy mirror:", legacyError);
  }
}

export async function recordApprovalStep(
  actionKey: string,
  requestId: string,
  stepNo: number,
  session: SessionContext,
  decision: "APPROVE" | "REJECT",
  reason?: unknown,
) {
  const next = decision === "APPROVE" ? "approved" : "rejected";
  const { data: step, error } = await supabase
    .from("approval_workflows")
    .update({
      status: next,
      approver_id: session.user.user_id,
      decision_reason: reason ? String(reason) : null,
      decided_at: nowISO(),
    })
    .eq("action_key", actionKey)
    .eq("request_id", requestId)
    .eq("step_no", stepNo)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!step) throw new Error("خطوة الاعتماد غير متاحة أو تم اتخاذ القرار بها بالفعل");

  if (decision === "APPROVE") {
    await supabase.from("approval_workflows")
      .update({ status: "pending" })
      .eq("action_key", actionKey)
      .eq("request_id", requestId)
      .eq("step_no", stepNo + 1)
      .eq("status", "waiting");
  }

  await writeGovernanceAudit(session, actionKey, requestId, next, reason);
  return step;
}

async function writeGovernanceAudit(
  session: SessionContext,
  actionKey: string,
  requestId: string,
  result: string,
  reason?: unknown,
) {
  const { error } = await supabase.from("hr_audit_log").insert({
    actor_id: session.user.user_id,
    action_key: actionKey,
    entity_type: actionKey === "leave_approval" ? "leave_request" : "permission_request",
    entity_id: requestId,
    after_data: { result, reason: reason ? String(reason) : null },
    created_at: nowISO(),
  });
  if (error) console.error("governance audit:", error);
}

export async function approvalInbox(session: SessionContext) {
  const role = session.user.role;
  if (!APPROVAL_ROLES.leave_approval.includes(role) && !APPROVAL_ROLES.permission_approval.includes(role)) {
    return errorResponse("ليس لديك صلاحية عرض مركز الاعتمادات.", 403);
  }

  const managedProjectIds = ["PROJECT_MANAGER", "SECTOR_MANAGER"].includes(role)
    ? await getManagedProjectIds(session.user)
    : [];

  const [leaves, permissions] = await Promise.all([
    supabase.from("leave_requests").select("*").in("status", ["PENDING_MANAGER","PENDING_HR"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("permission_requests").select("*").eq("status", "PENDING").order("created_at", { ascending: false }).limit(100),
  ]);

  if (leaves.error) return errorResponse(leaves.error.message, 500);
  if (permissions.error) return errorResponse(permissions.error.message, 500);

  const items: any[] = [];
  for (const r of leaves.data || []) {
    const isHR = r.status === "PENDING_HR";
    const allowed = isHR
      ? ["SYSTEM_ADMIN","HR_MANAGER"].includes(role)
      : ["PROJECT_MANAGER","SECTOR_MANAGER"].includes(role) && managedProjectIds.includes(String(r.project_id));
    if (allowed) items.push({ type: "leave", id: r.request_id, status: r.status, employee_id: r.employee_id, project_id: r.project_id, created_at: r.created_at, title: "طلب إجازة", requires: isHR ? "الموارد البشرية" : "مدير المشروع" });
  }
  for (const r of permissions.data || []) {
    const allowed = ["SYSTEM_ADMIN","HR_MANAGER"].includes(role) || (["PROJECT_MANAGER","SECTOR_MANAGER"].includes(role) && managedProjectIds.includes(String(r.project_id)));
    if (allowed) items.push({ type: "permission", id: r.request_id, status: r.status, employee_id: r.employee_id, project_id: r.project_id, created_at: r.created_at, title: "طلب إذن", requires: "المعتمد المختص" });
  }
  items.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  return success({ total: items.length, items });
}

export async function createApprovalRequest(session: SessionContext, body: Record<string, unknown>) {
  const actionKey = String(body.action_key || "").trim();
  if (!APPROVAL_ROLES[actionKey]) return errorResponse("نوع الاعتماد غير معروف.");
  const targetEmployeeId = body.target_employee_id ? String(body.target_employee_id) : null;
  if (targetEmployeeId && targetEmployeeId === session.user.employee_id) {
    return errorResponse("لا يجوز اعتماد إجراء يخص مقدم الطلب نفسه.", 403);
  }
  const { data, error } = await supabase.from("hr_approval_requests").insert({
    id: generateId("APR"),
    action_key: actionKey,
    target_employee_id: targetEmployeeId,
    target_project_id: body.target_project_id ? String(body.target_project_id) : null,
    requested_by: session.user.user_id,
    status: "pending",
    reason: body.reason ? String(body.reason) : null,
    created_at: nowISO(),
  }).select("*").single();
  if (error) return errorResponse(error.message, 500);
  return success(data, 201);
}

export async function approvalRequests(session: SessionContext) {
  const allowed = Object.entries(APPROVAL_ROLES).filter(([, roles]) => roles.includes(session.user.role)).map(([k]) => k);
  if (!allowed.length) return errorResponse("ليس لديك صلاحية.", 403);
  let query = supabase.from("hr_approval_requests").select("*").in("action_key", allowed).eq("status", "pending").order("created_at", { ascending: false });
  if (["PROJECT_MANAGER", "SECTOR_MANAGER"].includes(session.user.role)) {
    const projectIds = await getManagedProjectIds(session.user);
    if (!projectIds.length) return success([]);
    query = query.in("target_project_id", projectIds);
  }
  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);
  return success(data || []);
}
