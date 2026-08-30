import { supabase, success, errorResponse, generateId, nowISO, getManagedProjectIds, appDate } from "./core";
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

  const { data: policies } = await supabase
    .from("approval_sla_policies")
    .select("step_no,sla_hours,reminder_hours,escalation_role")
    .eq("action_key", actionKey)
    .eq("active", true);
  const policyMap = new Map((policies || []).map((x:any)=>[Number(x.step_no), x]));
  const created = Date.now();
  const rows = steps.map((role, index) => {
    const policy = policyMap.get(index + 1);
    const slaHours = Number(policy?.sla_hours || 24);
    const reminderHours = Number(policy?.reminder_hours || Math.max(1, Math.floor(slaHours / 2)));
    return {
      action_key: actionKey, request_id: requestId, step_no: index + 1, approver_role: role,
      status: index === 0 ? "pending" : "waiting", created_at: nowISO(),
      sla_hours: slaHours,
      reminder_at: new Date(created + reminderHours * 3600 * 1000).toISOString(),
      due_at: new Date(created + slaHours * 3600 * 1000).toISOString(),
    };
  });

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
  const requestIds = items.map((x:any)=>String(x.id));
  if (requestIds.length) {
    const { data: workflowRows } = await supabase.from("approval_workflows").select("request_id,step_no,due_at,reminder_at,escalated_at,status").in("request_id",requestIds).eq("status","pending");
    const dueMap = new Map((workflowRows || []).map((x:any)=>[`${x.request_id}|${x.step_no}`,x]));
    for (const item of items) {
      const stepNo = item.status === "PENDING_HR" ? 2 : 1;
      const w = dueMap.get(`${item.id}|${stepNo}`);
      if (w) { item.due_at=w.due_at; item.reminder_at=w.reminder_at; item.escalated_at=w.escalated_at; item.overdue=Boolean(w.due_at && new Date(w.due_at) < new Date()); }
    }
  }
  items.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  return success({ total: items.length, overdue: items.filter((x:any)=>x.overdue).length, items });
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


export async function processApprovalSla() {
  const now = new Date();
  const { data: pending, error } = await supabase
    .from("approval_workflows")
    .select("id,action_key,request_id,step_no,approver_role,due_at,reminder_at,escalated_at,status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  let reminders = 0, escalations = 0;
  for (const step of pending || []) {
    const due = step.due_at ? new Date(step.due_at) : null;
    const reminder = step.reminder_at ? new Date(step.reminder_at) : null;
    const entity = step.action_key === "leave_approval" ? "إجازة" : step.action_key === "permission_approval" ? "إذن" : "طلب";
    if (due && due <= now && !step.escalated_at) {
      await supabase.from("approval_workflows").update({ escalated_at: nowISO() }).eq("id", step.id).eq("status", "pending");
      const role = step.approver_role === "PROJECT_MANAGER" || step.approver_role === "SECTOR_MANAGER" ? "HR_MANAGER" : "SYSTEM_ADMIN";
      const { data: users } = await supabase.from("users").select("id,role").eq("status","ACTIVE").eq("role",role);
      for (const u of users || []) {
        await supabase.from("notifications").insert({
          notification_id: generateId("NTF"), user_id: u.id, notification_type: "APPROVAL_ESCALATION",
          title: "اعتماد متأخر", message: `يوجد ${entity} متأخر عن موعد الاعتماد ويحتاج إلى تصعيد.`,
          severity: "CRITICAL", entity_type: step.action_key, entity_id: step.request_id, created_at: nowISO()
        });
        escalations++;
      }
      continue;
    }
    if (reminder && reminder <= now) {
      const { data: existing } = await supabase.from("notifications").select("notification_id").eq("notification_type","APPROVAL_REMINDER").eq("entity_id",step.request_id).limit(1);
      if (!(existing || []).length) {
        const roles = step.approver_role === "PROJECT_MANAGER" ? ["PROJECT_MANAGER"] : step.approver_role === "SECTOR_MANAGER" ? ["SECTOR_MANAGER"] : ["HR_MANAGER","SYSTEM_ADMIN"];
        const { data: users } = await supabase.from("users").select("id,role").eq("status","ACTIVE").in("role",roles);
        for (const u of users || []) {
          await supabase.from("notifications").insert({
            notification_id: generateId("NTF"), user_id: u.id, notification_type: "APPROVAL_REMINDER",
            title: "تذكير باعتماد", message: `يوجد ${entity} ينتظر اعتمادك.`, severity: "WARNING",
            entity_type: step.action_key, entity_id: step.request_id, created_at: nowISO()
          });
          reminders++;
        }
      }
    }
  }
  return { checked: (pending || []).length, reminders, escalations, processed_at: nowISO() };
}
