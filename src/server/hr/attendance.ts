import { parsePagination } from "./core";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, appDate, previousAppDate, appTime, APP_TIMEZONE, timeToMinutes, minutesBetween, isTimeWithinWindow, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

async function getApprovedLeave(employeeId: string, date: string) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("request_id,leave_type_id,from_date,to_date,days,reason,status")
    .eq("employee_id", employeeId)
    .eq("status", "APPROVED")
    .lte("from_date", date)
    .gte("to_date", date)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getApprovedEndOfDayPermission(employeeId: string, date: string, checkoutOpen: string) {
  const { data, error } = await supabase
    .from("permission_requests")
    .select("request_id,permission_type,start_time,end_time,status")
    .eq("employee_id", employeeId)
    .eq("date", date)
    .eq("status", "APPROVED")
    .gte("end_time", checkoutOpen)
    .order("end_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

  let rows = data || [];

  // Show approved leave days in the attendance registry so HR sees a complete daily status.
  // Keep the window bounded to the current calendar month to avoid expanding a full year's leave days.
  const todayForLeaves = appDate();
  const monthStart = `${todayForLeaves.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);

  let leaveQuery = supabase
    .from("leave_requests")
    .select("request_id,employee_id,project_id,leave_type_id,from_date,to_date,days,reason,status")
    .eq("status", "APPROVED")
    .lte("from_date", monthEnd)
    .gte("to_date", monthStart);

  if (session.user.role === "EMPLOYEE") {
    if (!session.user.employee_id) return success(rows);
    leaveQuery = leaveQuery.eq("employee_id", session.user.employee_id);
  } else if (["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(session.user.role)) {
    const ids = await getManagedProjectIds(session.user);
    if (!ids.length) return success(rows);
    leaveQuery = leaveQuery.in("project_id", ids);
  }

  const { data: approvedLeaves, error: leaveError } = await leaveQuery;
  if (leaveError) return errorResponse(leaveError.message, 500);

  const leaveByDay = new Map<string, any>();
  for (const leave of approvedLeaves || []) {
    const start = new Date(`${leave.from_date}T00:00:00Z`);
    const end = new Date(`${leave.to_date}T00:00:00Z`);
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      if (day < monthStart || day > monthEnd) continue;
      leaveByDay.set(`${leave.employee_id}|${day}`, leave);
    }
  }

  const attendanceByKey = new Map(rows.map((r:any) => [`${r.employee_id}|${r.date}`, r]));
  for (const [key, leave] of leaveByDay) {
    const [employeeId, date] = key.split("|");
    const existingRow = attendanceByKey.get(key);
    const virtualRow = {
      ...(existingRow || {}),
      attendance_id: existingRow?.attendance_id || `LEAVE-${leave.request_id}-${date}`,
      employee_id: employeeId,
      project_id: leave.project_id || existingRow?.project_id || null,
      date,
      check_in: null,
      check_out: null,
      worked_minutes: null,
      late_minutes: 0,
      auto_closed: false,
      manual_modified: false,
      status: "LEAVE",
      leave_request_id: leave.request_id,
      leave_type_id: leave.leave_type_id,
      leave_reason: leave.reason || null,
    };
    if (existingRow) {
      const idx = rows.findIndex((r:any) => `${r.employee_id}|${r.date}` === key);
      if (idx >= 0) rows[idx] = virtualRow;
    } else {
      rows.push(virtualRow);
    }
  }
  rows.sort((a:any,b:any) => String(b.date).localeCompare(String(a.date)) || String(b.check_in || "").localeCompare(String(a.check_in || "")));

  return success(rows);
}

/* =========================================================
   الموقع الجغرافي ATTENDANCE
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


  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const gpsAccuracy = Number(body.gps_accuracy_m);

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return errorResponse('إحداثيات الموقع الجغرافي خارج النطاق الصحيح');
  }
  if (!Number.isFinite(gpsAccuracy) || gpsAccuracy < 0 || gpsAccuracy > 500) {
    return errorResponse('دقة الموقع الجغرافي غير كافية. فعّل تحديد الموقع بدقة عالية وحاول مرة أخرى.');
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return errorResponse('إحداثيات الموقع الجغرافي غير صحيحة');
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

  if (radius <= 0 || radius < 1) {
    return errorResponse('نطاق الموقع الجغرافي للمشروع غير مضبوط بشكل صحيح');
  }

  if (distance + gpsAccuracy > radius) {
    return errorResponse(
      `أنت خارج نطاق موقع المشروع (${Math.round(
        distance
      )} متر)`
    );
  }

  const clientEventId = String(body.client_event_id || '').trim() || null;
  const clientRecordedAt = String(body.client_recorded_at || '').trim() || null;
  const gpsTimestamp = String(body.gps_timestamp || '').trim() || clientRecordedAt;
  const offlineSource = body.__offline_sync === true && String(body.offline_source || '').toUpperCase() === 'OFFLINE_SYNC';

  if (gpsTimestamp) {
    const gpsParsed = new Date(gpsTimestamp);
    if (Number.isNaN(gpsParsed.getTime())) return errorResponse('وقت الموقع الجغرافي غير صالح');
    const gpsAge = Date.now() - gpsParsed.getTime();
    if (gpsAge < -5 * 60 * 1000 || gpsAge > 7 * 24 * 60 * 60 * 1000) {
      return errorResponse('وقت الموقع الجغرافي غير صالح أو خارج المدة المسموح بها');
    }
  }

  let eventDate = appDate();
  let eventTime = appTime();
  if (offlineSource && clientRecordedAt) {
    const parsed = new Date(clientRecordedAt);
    if (!Number.isNaN(parsed.getTime())) {
      const ageMs = Date.now() - parsed.getTime();
      if (ageMs < -5 * 60 * 1000 || ageMs > 7 * 24 * 60 * 60 * 1000) {
        return errorResponse('وقت التسجيل غير صالح أو أقدم من الحد المسموح للمزامنة');
      }
      eventDate = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(parsed);
      eventTime = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour:'2-digit', minute:'2-digit', hour12:false }).format(parsed);
    }
  }

  const overnightAttendance = timeToMinutes(String(shift.attendance_close)) < timeToMinutes(String(shift.attendance_open));
  const attendanceDate=overnightAttendance&&timeToMinutes(eventTime)<timeToMinutes(String(shift.attendance_open))?previousAppDate(eventDate):eventDate;
  const {data:existing}=await supabase.from("attendance").select("*").eq("employee_id",employeeId).eq("date",attendanceDate).maybeSingle();

  const approvedLeave = await getApprovedLeave(employeeId, attendanceDate);
  if (approvedLeave) {
    return errorResponse(`اليوم ضمن إجازة معتمدة. لا يمكن تسجيل ${action === "check_in" ? "الحضور" : "الانصراف"}.`);
  }

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
          check_in_distance_m: Math.round(distance),
          check_in_accuracy_m: Math.round(gpsAccuracy),
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

  const approvedEndPermission = await getApprovedEndOfDayPermission(employeeId, attendanceDate, String(shift.checkout_open));
  if (approvedEndPermission) {
    return errorResponse("يوجد إذن معتمد يغطي نهاية ساعات العمل، ولا يلزم تسجيل الانصراف لهذا اليوم.");
  }

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
        check_out_distance_m: Math.round(distance),
        check_out_accuracy_m: Math.round(gpsAccuracy),
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
  const today=appDate(); const previousDate=previousAppDate(today); const currentTime=appTime(); const currentMinutes=timeToMinutes(currentTime);
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
    if (!autoTime) continue;

    const rs = (row as any).shifts || {};
    const autoMinutes = timeToMinutes(String(autoTime));
    const shiftOvernight = timeToMinutes(String(rs.attendance_close || "00:00")) < timeToMinutes(String(rs.attendance_open || "23:59"));
    const rowDate = String(row.date);

    // For an overnight shift the auto-checkout time belongs to the following
    // calendar day. A previous-day attendance is therefore eligible once the
    // current clock reaches the auto-checkout time. Today's overnight record is
    // intentionally left open until tomorrow's auto-checkout window.
    const eligible = shiftOvernight
      ? rowDate === previousDate && currentMinutes >= autoMinutes
      : rowDate === today && currentMinutes >= autoMinutes;

    if (!eligible) continue;

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
      .is("check_out", null)
      .eq("auto_closed", false);

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

  const closeTime = appTime();
  const workedMinutes = row.check_in ? minutesBetween(String(row.check_in), closeTime) : 0;
  const { error: updateError } = await supabase
    .from('attendance')
    .update({
      check_out: closeTime,
      worked_minutes: workedMinutes,
      auto_closed: false,
      manual_modified: true,
      modified_by: session.user.user_id,
      modified_at: nowISO(),
      status: 'MANUAL_CLOSED',
      updated_at: nowISO(),
    })
    .eq('attendance_id', attendanceId)
    .is('check_out', null);

  if (updateError) throw updateError;
  return { ok: true, closed: true };
}
