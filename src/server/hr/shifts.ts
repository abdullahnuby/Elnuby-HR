import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listShifts(_body: Record<string, unknown> = {}) {
  const { data, error } =
    await supabase
      .from("shifts")
      .select("*")
      .order("name");

  if (error) {
    return errorResponse(
      "تعذر تحميل الورديات",
      500
    );
  }

  return success(data || []);
}

export async function createShift(
  body: Record<string, unknown>
) {
  const name = String(
    body.name || ""
  ).trim();

  if (!name) {
    return errorResponse(
      "اسم الوردية مطلوب"
    );
  }

  const required = [
    "start_time",
    "attendance_open",
    "attendance_close",
    "checkout_open",
    "checkout_close",
    "auto_checkout_time",
  ];

  for (const field of required) {
    if (!body[field]) {
      return errorResponse(
        `الحقل ${field} مطلوب`
      );
    }
  }

  const { data, error } =
    await supabase
      .from("shifts")
      .insert({
        shift_id:
          String(
            body.shift_id ||
              generateId("SHF")
          ),
        name,
        start_time:
          String(
            body.start_time
          ),
        attendance_open:
          String(
            body.attendance_open
          ),
        attendance_close:
          String(
            body.attendance_close
          ),
        checkout_open:
          String(
            body.checkout_open
          ),
        checkout_close:
          String(
            body.checkout_close
          ),
        auto_checkout_time:
          String(
            body.auto_checkout_time
          ),
        status:
          body.status ||
          "ACTIVE",
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
   EMPLOYEE SHIFTS
========================================================= */

