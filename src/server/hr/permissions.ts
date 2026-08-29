import { parsePagination } from "./core";
import { supabase, success, errorResponse, generateId, nowISO, appDate, appTime, timeToMinutes, minutesBetween, getManagedProjectIds, canManageProject, getCurrentAssignment, normalizeTimeInput } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function permissionList(
  session: SessionContext,
  body: Record<string, unknown> = {},
) {
  const { from, to } = parsePagination(body, 100);
  let query = supabase
    .from("permission_requests")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .range(from, to);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  if (["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(session.user.role)) {
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

export async function createPermission(
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
      "لا يوجد مشروع حالي"
    );
  }

  const date = String(
    body.date ||
      appDate()
  );

  const startTime = normalizeTimeInput(body.start_time);

  const endTime = normalizeTimeInput(body.end_time);

  if (
    !startTime ||
    !endTime
  ) {
    return errorResponse(
      "وقت بداية ونهاية الإذن مطلوبان"
    );
  }

  if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse("تاريخ الإذن غير صحيح");
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    return errorResponse("وقت بداية الإذن يجب أن يسبق وقت نهايته في نفس اليوم");
  }

  const minutes = minutesBetween(startTime, endTime);

  if (minutes <= 0) {
    return errorResponse(
      "وقت الإذن غير صحيح"
    );
  }

  const { data: existingPermissions } = await supabase
    .from("permission_requests")
    .select("start_time,end_time,status")
    .eq("employee_id", employeeId)
    .eq("date", date)
    .in("status", ["PENDING", "APPROVED"]);

  const requestedStart = timeToMinutes(startTime);
  const requestedEnd = requestedStart + minutes;
  const overlaps = (existingPermissions || []).some((row: any) => {
    const existingStart = timeToMinutes(String(row.start_time));
    const existingEnd = timeToMinutes(String(row.end_time));
    return requestedStart < existingEnd && existingStart < requestedEnd;
  });
  if (overlaps) {
    return errorResponse("يوجد إذن آخر متداخل مع نفس الفترة.");
  }

  const { data, error } =
    await supabase
      .from("permission_requests")
      .insert({
        request_id:
          generateId("PR"),
        employee_id:
          employeeId,
        project_id:
          assignment.project_id,
        date,
        start_time:
          startTime,
        end_time:
          endTime,
        minutes,
        permission_type: String(body.permission_type || "GENERAL").trim() || "GENERAL",
        reason:
          body.reason ||
          null,
        status:
          "PENDING",
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

export async function decidePermission(
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
      .from("permission_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإذن غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار القرار"
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

  const { data, error } =
    await supabase
      .from("permission_requests")
      .update({
        status:
          decision === "APPROVE"
            ? "APPROVED"
            : "REJECTED",
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
   DEDUCTIONS
========================================================= */

