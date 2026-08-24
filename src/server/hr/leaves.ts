import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function leaveList(
  session: SessionContext
) {
  let query = supabase
    .from("leave_requests")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  if (["PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    query = query.in(
      "project_id",
      ids
    );
  }

  const { data, error } =
    await query;

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

/* =========================================================
   CREATE LEAVE
========================================================= */

export async function createLeave(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId =
    session.user.employee_id;

  if (!employeeId) {
    return errorResponse(
      "الحساب غير مرتبط بموظف"
    );
  }

  const assignment =
    await getCurrentAssignment(
      employeeId
    );

  if (!assignment) {
    return errorResponse(
      "لا يوجد مشروع حالي للموظف"
    );
  }

  const fromDate = String(
    body.from_date || ""
  );

  const toDate = String(
    body.to_date || ""
  );

  if (
    !fromDate ||
    !toDate
  ) {
    return errorResponse(
      "تاريخ بداية ونهاية الإجازة مطلوبان"
    );
  }

  const from =
    new Date(
      `${fromDate}T00:00:00`
    );

  const to =
    new Date(
      `${toDate}T00:00:00`
    );

  const days =
    Math.floor(
      (to.getTime() -
        from.getTime()) /
        86400000
    ) + 1;

  if (
    !Number.isFinite(
      days
    ) ||
    days < 1
  ) {
    return errorResponse(
      "تواريخ الإجازة غير صحيحة"
    );
  }

  const leaveTypeId =
    String(
      body.leave_type_id ||
        ""
    );

  if (!leaveTypeId) {
    return errorResponse(
      "نوع الإجازة مطلوب"
    );
  }

  const { data: leaveType } =
    await supabase
      .from("leave_types")
      .select("*")
      .eq(
        "leave_type_id",
        leaveTypeId
      )
      .maybeSingle();

  if (!leaveType) {
    return errorResponse(
      "نوع الإجازة غير موجود"
    );
  }

  const { data, error } =
    await supabase
      .from("leave_requests")
      .insert({
        request_id:
          generateId("LV"),
        employee_id:
          employeeId,
        project_id:
          assignment.project_id,
        leave_type_id:
          leaveTypeId,
        from_date:
          fromDate,
        to_date:
          toDate,
        days,
        reason:
          body.reason ||
          null,
        status:
          "PENDING_MANAGER",
        created_at:
          nowISO(),
        updated_at:
          nowISO(),
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data,
    201
  );
}

/* =========================================================
   MANAGER LEAVE DECISION
========================================================= */

export async function decideLeaveManager(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const requestId = String(
    body.request_id || ""
  );

  const decision =
    String(
      body.decision || ""
    ).toUpperCase();

  if (
    !requestId ||
    !["APPROVE", "REJECT"].includes(
      decision
    )
  ) {
    return errorResponse(
      "بيانات القرار غير صحيحة"
    );
  }

  const { data: request } =
    await supabase
      .from("leave_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإجازة غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING_MANAGER"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار اعتماد مدير المشروع"
    );
  }

  const allowed =
    await canManageProject(
      session.user,
      request.project_id
    );

  if (!allowed) {
    return errorResponse(
      "الطلب غير تابع لمشروعك",
      403
    );
  }

  const newStatus =
    decision === "APPROVE"
      ? "PENDING_HR"
      : "REJECTED";

  const { data, error } =
    await supabase
      .from("leave_requests")
      .update({
        status:
          newStatus,
        manager_id:
          session.user.user_id,
        manager_decision_at:
          nowISO(),
        manager_comment:
          body.comment ||
          null,
        updated_at:
          nowISO(),
      })
      .eq(
        "request_id",
        requestId
      )
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   HR LEAVE DECISION
========================================================= */

export async function decideLeaveHR(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const requestId = String(
    body.request_id || ""
  );

  const decision =
    String(
      body.decision || ""
    ).toUpperCase();

  if (
    !requestId ||
    !["APPROVE", "REJECT"].includes(
      decision
    )
  ) {
    return errorResponse(
      "بيانات القرار غير صحيحة"
    );
  }

  const { data: request } =
    await supabase
      .from("leave_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإجازة غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING_HR"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار اعتماد HR"
    );
  }

  const newStatus =
    decision === "APPROVE"
      ? "APPROVED"
      : "REJECTED";

  const { data, error } =
    await supabase
      .from("leave_requests")
      .update({
        status:
          newStatus,
        hr_decision:
          decision,
        hr_decision_at:
          nowISO(),
        hr_comment:
          body.comment ||
          null,
        updated_at:
          nowISO(),
      })
      .eq(
        "request_id",
        requestId
      )
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   PERMISSIONS
========================================================= */

