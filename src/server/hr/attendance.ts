import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function attendanceList(
  session: SessionContext
) {
  let query = supabase
    .from("attendance")
    .select("*")
    .order(
      "date",
      {
        ascending: false,
      }
    )
    .order(
      "check_in",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    if (
      !session.user.employee_id
    ) {
      return success([]);
    }

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
   GPS ATTENDANCE
========================================================= */

export async function attendanceAction(
  session: SessionContext,
  action: string,
  body: Record<string, unknown>
) {
  if (
    session.user.role !==
    "EMPLOYEE"
  ) {
    return errorResponse(
      "فقط الموظف يستطيع تسجيل الحضور والانصراف",
      403
    );
  }

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

  const { data: project } =
    await supabase
      .from("projects")
      .select("*")
      .eq(
        "project_id",
        assignment.project_id
      )
      .maybeSingle();

  if (!project) {
    return errorResponse(
      "المشروع الحالي غير موجود"
    );
  }

  const employeeShift =
    await getCurrentEmployeeShift(
      employeeId,
      assignment.project_id
    );

  if (!employeeShift) {
    return errorResponse(
      "لا توجد وردية حالية للموظف"
    );
  }

  const shift =
    employeeShift.shifts;

  if (!shift) {
    return errorResponse(
      "الوردية غير موجودة"
    );
  }

  const latitude = Number(
    body.latitude
  );

  const longitude = Number(
    body.longitude
  );

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return errorResponse(
      "إحداثيات GPS غير صحيحة"
    );
  }

  if (
    project.latitude == null ||
    project.longitude == null
  ) {
    return errorResponse(
      "موقع المشروع غير محدد"
    );
  }

  const distance =
    haversineDistance(
      latitude,
      longitude,
      Number(project.latitude),
      Number(project.longitude)
    );

  const radius = Number(
    project.geofence_radius_m ||
      0
  );

  if (
    radius > 0 &&
    distance > radius
  ) {
    return errorResponse(
      `أنت خارج نطاق موقع المشروع (${Math.round(
        distance
      )} متر)`
    );
  }

  const today =
    riyadhDate();

  const currentTime =
    riyadhTime();

  const { data: existing } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        employeeId
      )
      .eq(
        "date",
        today
      )
      .maybeSingle();

  /* ======================
     CHECK IN
  ====================== */

  if (
    action === "check_in"
  ) {
    if (
      existing?.check_in
    ) {
      return errorResponse(
        "تم تسجيل الحضور بالفعل"
      );
    }

    const current =
      timeToMinutes(
        currentTime
      );

    const open =
      timeToMinutes(
        shift.attendance_open
      );

    const close =
      timeToMinutes(
        shift.attendance_close
      );

    if (
      current < open ||
      current > close
    ) {
      return errorResponse(
        "الحضور غير متاح في هذا الوقت"
      );
    }

    const shiftStart =
      timeToMinutes(
        shift.start_time
      );

    const isLate =
      current > shiftStart;

    const lateMinutes =
      isLate
        ? Math.max(
            0,
            current -
              shiftStart
          )
        : 0;

    const { data, error } =
      await supabase
        .from("attendance")
        .insert({
          attendance_id:
            generateId("ATT"),
          employee_id:
            employeeId,
          project_id:
            assignment.project_id,
          shift_id:
            employeeShift.shift_id,
          date:
            today,
          check_in:
            currentTime,
          check_in_lat:
            latitude,
          check_in_lng:
            longitude,
          check_in_distance_m:
            Math.round(
              distance
            ),
          status:
            isLate
              ? "LATE"
              : "PRESENT",
          late_minutes:
            lateMinutes,
          created_at:
            nowISO(),
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "check_in:",
        error
      );

      return errorResponse(
        error.message,
        500
      );
    }

    return success(data);
  }

  /* ======================
     CHECK OUT
  ====================== */

  if (!existing?.check_in) {
    return errorResponse(
      "لم يتم تسجيل الحضور"
    );
  }

  if (
    existing.check_out
  ) {
    return errorResponse(
      "تم تسجيل الانصراف بالفعل"
    );
  }

  const current =
    timeToMinutes(
      currentTime
    );

  const open =
    timeToMinutes(
      shift.checkout_open
    );

  const close =
    timeToMinutes(
      shift.checkout_close
    );

  if (
    current < open ||
    current > close
  ) {
    return errorResponse(
      "الانصراف غير متاح في هذا الوقت"
    );
  }

  const workedMinutes =
    minutesBetween(
      String(
        existing.check_in
      ),
      currentTime
    );

  const { data, error } =
    await supabase
      .from("attendance")
      .update({
        check_out:
          currentTime,
        check_out_lat:
          latitude,
        check_out_lng:
          longitude,
        check_out_distance_m:
          Math.round(
            distance
          ),
        worked_minutes:
          workedMinutes,
        updated_at:
          nowISO(),
      })
      .eq(
        "attendance_id",
        existing.attendance_id
      )
      .select("*")
      .single();

  if (error) {
    console.error(
      "check_out:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   LEAVE LIST
========================================================= */

