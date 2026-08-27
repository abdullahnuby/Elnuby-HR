import { parsePagination } from "./core";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, previousRiyadhDate, riyadhTime, timeToMinutes, minutesBetween, isTimeWithinWindow, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function attendanceList(
  session: SessionContext,
  body: Record<string, unknown> = {},
) {
  try {
    await autoCheckoutOpenAttendance();
  } catch (error) {
    console.error("attendance auto checkout:", error);
  }
  const { from, to } = parsePagination(body, 100);
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
    .range(from, to);

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

/* =========================================================
   GPS ATTENDANCE
========================================================= */

export async function attendanceAction(
  session: SessionContext,
  action: string,
  body: Record<string, unknown>
) {
  if (!["EMPLOYEE", "PROJECT_MANAGER"].includes(session.user.role)) {
    return errorResponse(
      "هذا الحساب غير مصرح له بتسجيل الحضور والانصراف",
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

  const clientEventId = String(body.client_event_id || '').trim() || null;
  const clientRecordedAt = String(body.client_recorded_at || '').trim() || null;
  const offlineSource = String(body.offline_source || '').toUpperCase() === 'OFFLINE_SYNC';

  let eventDate = riyadhDate();
  let eventTime = riyadhTime();
  if (offlineSource && clientRecordedAt) {
    const parsed = new Date(clientRecordedAt);
    if (!Number.isNaN(parsed.getTime())) {
      const ageMs = Date.now() - parsed.getTime();
      if (ageMs < -5 * 60 * 1000 || ageMs > 7 * 24 * 60 * 60 * 1000) {
        return errorResponse('وقت التسجيل غير صالح أو أقدم من الحد المسموح للمزامنة');
      }
      eventDate = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit' }).format(parsed);
      eventTime = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.APP_TIMEZONE || 'Africa/Cairo', hour:'2-digit', minute:'2-digit', hour12:false }).format(parsed);
    }
  }

  const overnightAttendance=timeToMinutes(String(shift.attendance_close))<timeToMinutes(String(shift.attendance_open));
  const attendanceDate=overnightAttendance&&timeToMinutes(eventTime)<timeToMinutes(String(shift.attendance_open))?previousRiyadhDate(eventDate):eventDate;
  const {data:existing}=await supabase.from("attendance").select("*").eq("employee_id",employeeId).eq("date",attendanceDate).maybeSingle();

  /* ======================
     CHECK IN
  ====================== */

  if (
    action === "check_in"
  ) {
    if (clientEventId) {
      const { data: alreadySynced } = await supabase.from('attendance').select('*').eq('client_event_id', clientEventId).maybeSingle();
      if (alreadySynced) return success(alreadySynced);
    }
    if (
      existing?.check_in
    ) {
      return errorResponse(
        "تم تسجيل الحضور بالفعل"
      );
    }

    const current =
      timeToMinutes(
        eventTime
      );

    const open =
      timeToMinutes(
        shift.attendance_open
      );

    const close =
      timeToMinutes(
        shift.attendance_close
      );

    if (!isTimeWithinWindow(eventTime, shift.attendance_open, shift.attendance_close)) {
      return errorResponse(
        "الحضور غير متاح في هذا الوقت"
      );
    }

    const shiftStart =
      timeToMinutes(
        shift.start_time
      );

    const overnightShift = timeToMinutes(String(shift.attendance_close)) < timeToMinutes(String(shift.attendance_open));
    const logicalCurrent = overnightShift && current < shiftStart ? current + 1440 : current;
    const isLate = logicalCurrent > shiftStart;
    const lateMinutes = isLate ? Math.max(0, logicalCurrent - shiftStart) : 0;

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
            attendanceDate,
          check_in:
            eventTime,
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
          client_event_id: clientEventId,
          source: offlineSource ? 'OFFLINE_SYNC' : 'ONLINE',
          client_recorded_at: clientRecordedAt,
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

  if (clientEventId) {
    const { data: alreadyClosed } = await supabase.from('attendance').select('*').eq('check_out_event_id', clientEventId).maybeSingle();
    if (alreadyClosed) return success(alreadyClosed);
  }

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
      eventTime
    );

  const open =
    timeToMinutes(
      shift.checkout_open
    );

  const close =
    timeToMinutes(
      shift.checkout_close
    );

  if (!isTimeWithinWindow(eventTime, shift.checkout_open, shift.checkout_close)) {
    return errorResponse(
      "الانصراف غير متاح في هذا الوقت"
    );
  }

  const workedMinutes =
    minutesBetween(
      String(
        existing.check_in
      ),
      eventTime
    );

  const { data, error } =
    await supabase
      .from("attendance")
      .update({
        check_out:
          eventTime,
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
        check_out_event_id: clientEventId,
        source: offlineSource ? 'OFFLINE_SYNC' : existing.source || 'ONLINE',
        client_recorded_at: clientRecordedAt || existing.client_recorded_at || null,
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


/* =========================================================
   AUTO CHECKOUT
========================================================= */

export async function autoCheckoutOpenAttendance() {
  const today=riyadhDate(); const previousDate=previousRiyadhDate(today); const currentTime=riyadhTime(); const currentMinutes=timeToMinutes(currentTime);
  const {data:rows,error}=await supabase.from("attendance")
    .select("attendance_id,employee_id,check_in,check_out,date,auto_closed,shift_id,shifts(auto_checkout_time,attendance_open,attendance_close)")
    .in("date",[today,previousDate])
    .not("check_in", "is", null)
    .is("check_out", null)
    .eq("auto_closed", false);

  if (error) {
    console.error("auto checkout lookup:", error);
    throw error;
  }

  let closed = 0;
  for (const row of rows || []) {
    const autoTime = (row as any).shifts?.auto_checkout_time;
    const autoMinutes=timeToMinutes(autoTime); if(!autoTime) continue; const rs=(row as any).shifts||{}; const overnight=timeToMinutes(String(rs.attendance_close||'00:00'))<timeToMinutes(String(rs.attendance_open||'23:59')); const eligible=overnight&&String(row.date)===previousDate?(currentMinutes<=autoMinutes||currentMinutes>=timeToMinutes(String(rs.attendance_open||'23:59'))):currentMinutes>=autoMinutes; if(!eligible) continue;

    const workedMinutes = minutesBetween(String(row.check_in), String(autoTime));
    const { error: updateError } = await supabase
      .from("attendance")
      .update({
        check_out: autoTime,
        worked_minutes: workedMinutes,
        auto_closed: true,
        updated_at: nowISO(),
      })
      .eq("attendance_id", row.attendance_id)
      .is("check_out", null);

    if (updateError) {
      console.error("auto checkout update:", updateError);
      continue;
    }
    closed += 1;
  }

  return { closed, date: today, time: currentTime };
}


export async function closeAttendance(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const attendanceId = String(body?.attendance_id || '').trim();
  if (!attendanceId) throw new Error('رقم سجل الحضور مطلوب');

  const { data: row, error } = await supabase
    .from('attendance')
    .select('attendance_id,check_in,check_out')
    .eq('attendance_id', attendanceId)
    .maybeSingle();

  if (error) throw error;
  if (!row) throw new Error('سجل الحضور غير موجود');
  if (row.check_out) return { ok: true, closed: false, already_closed: true };

  const { error: updateError } = await supabase
    .from('attendance')
    .update({
      check_out: riyadhTime(),
      auto_closed: false,
      status: 'MANUAL_CLOSED',
      updated_at: nowISO(),
    })
    .eq('attendance_id', attendanceId)
    .is('check_out', null);

  if (updateError) throw updateError;
  return { ok: true, closed: true };
}
