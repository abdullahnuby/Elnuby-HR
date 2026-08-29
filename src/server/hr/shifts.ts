import { supabase, success, errorResponse, generateId, nowISO, writeسجل التدقيق } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listShifts(session: SessionContext, _body: Record<string, unknown> = {}) {
  if (session.user.role === "EMPLOYEE") {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("employee_shifts")
      .select("shift_id")
      .eq("employee_id", session.user.employee_id || "");
    if (assignmentError) return errorResponse("تعذر تحميل ورديات الموظف", 500);
    const ids = [...new Set((assignmentRows || []).map((r: any) => r.shift_id).filter(Boolean))];
    if (!ids.length) return success([]);
    const { data, error } = await supabase.from("shifts").select("*").in("shift_id", ids).order("name");
    if (error) return errorResponse("تعذر تحميل الورديات", 500);
    return success(data || []);
  }

  const { data, error } = await supabase.from("shifts").select("*").order("name");

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



export async function updateShift(session: SessionContext, body: Record<string, unknown>) {
  const shiftId=String(body.shift_id||'').trim(); if(!shiftId) return errorResponse('رقم الوردية مطلوب'); const changes:Record<string,unknown>={};
  for(const k of ['name','start_time','attendance_open','attendance_close','checkout_open','checkout_close','auto_checkout_time','status']) if(body[k]!==undefined) changes[k]=body[k];
  if(!Object.keys(changes).length) return errorResponse('لا توجد بيانات للتعديل'); const {data,error}=await supabase.from('shifts').update(changes).eq('shift_id',shiftId).select('*').maybeSingle();
  if(error) return errorResponse(error.message,500); if(!data) return errorResponse('الوردية غير موجودة',404); await writeسجل التدقيق(session.user.user_id,'update_shift','shifts',shiftId,{changes}); return success(data);
}
